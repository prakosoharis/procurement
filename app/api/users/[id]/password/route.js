import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '../../../../../lib/db';
import { currentUser } from '../../../../../lib/current-user';
import { writeAudit } from '../../../../../lib/documents';

export async function PATCH(request, { params }) {
  const admin = await currentUser();
  if (admin?.role !== 'SUPER_USER') return NextResponse.json({ error: 'Super User access required' }, { status: 403 });
  const { id } = await params;
  const { password } = await request.json();
  if (typeof password !== 'string' || password.length < 8) return NextResponse.json({ error: 'Password baru minimal 8 karakter.' }, { status: 400 });
  const target = await db.user.findUnique({ where: { id }, select: { id: true, name: true, role: true } });
  if (!target) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
  await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  await writeAudit(admin.id, 'User', id, 'RESET_PASSWORD', JSON.stringify({ name: target.name, role: target.role }));
  return NextResponse.json({ ok: true, name: target.name });
}
