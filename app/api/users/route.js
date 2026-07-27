import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';
import { writeAudit } from '../../../lib/documents';

export async function GET() {
  const user = await currentUser();
  if (user?.role !== 'SUPER_USER') return NextResponse.json({ error: 'Super User access required' }, { status: 403 });
  const users = await db.user.findMany({
    where: { role: { in: ['SUPER_USER', 'CORPORATE_GOVERNANCE', 'BUSINESS_UNIT_PIC'] } },
    select: { id: true, name: true, email: true, phone: true, role: true, jobTitle: true, businessUnit: { select: { name: true } } },
    orderBy: [{ role: 'asc' }, { name: 'asc' }]
  });
  return NextResponse.json(users);
}

export async function POST(request) {
  const actor = await currentUser();
  if (actor?.role !== 'SUPER_USER') return NextResponse.json({ error: 'Super User access required' }, { status: 403 });
  const { name, email, password, role, businessUnitId, phone, jobTitle, locale } = await request.json();
  const allowedRoles = new Set(['SUPER_USER', 'CORPORATE_GOVERNANCE', 'BUSINESS_UNIT_PIC']);
  if (!name?.trim() || !email?.trim() || !password || password.length < 8 || !allowedRoles.has(role)) {
    return NextResponse.json({ error: 'Nama, email, password minimal 8 karakter, dan role yang valid wajib diisi.' }, { status: 400 });
  }
  const isBusinessUnitPic = role === 'BUSINESS_UNIT_PIC';
  if (isBusinessUnitPic && !businessUnitId) return NextResponse.json({ error: 'Business Unit wajib dipilih untuk Business Unit PIC.' }, { status: 400 });
  if (isBusinessUnitPic && !await db.businessUnit.findUnique({ where: { id: businessUnitId } })) return NextResponse.json({ error: 'Business Unit tidak ditemukan.' }, { status: 404 });
  try {
    const created = await db.user.create({ data: { name: name.trim(), email: email.trim().toLowerCase(), passwordHash: await bcrypt.hash(password, 10), role, businessUnitId: isBusinessUnitPic ? businessUnitId : null, phone: phone?.trim() || null, jobTitle: jobTitle?.trim() || null, locale: locale || 'id' } });
    await writeAudit(actor.id, 'User', created.id, 'CREATE_USER', JSON.stringify({ role: created.role, businessUnitId: created.businessUnitId }));
    return NextResponse.json({ id: created.id, name: created.name, role: created.role }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Email sudah terdaftar atau data user tidak valid.' }, { status: 409 });
  }
}
