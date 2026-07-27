import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '../../../../../lib/db';
import { currentUser } from '../../../../../lib/current-user';
import { writeAudit } from '../../../../../lib/documents';

const resettableRoles = new Set(['BU_PIC', 'COMPLIANCE_REVIEWER', 'CORPORATE_PROCUREMENT']);

export async function PATCH(request, { params }) {
  const admin = await currentUser();
  if (!['SUPER_USER', 'COMPLIANCE_ADMIN'].includes(admin?.role)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const { id } = await params;
  const { password } = await request.json();
  if (typeof password !== 'string' || password.length < 8) return NextResponse.json({ error: 'Password baru minimal 8 karakter.' }, { status: 400 });
  const target = await db.user.findUnique({ where: { id }, select: { id: true, name: true, role: true } });
  if (!target || !(admin.role === 'SUPER_USER' || resettableRoles.has(target.role))) return NextResponse.json({ error: 'User tidak ditemukan atau tidak dapat diubah dari menu ini.' }, { status: 404 });
  await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  await writeAudit(admin.id, 'User', id, 'RESET_PASSWORD', JSON.stringify({ name: target.name, role: target.role }));
  return NextResponse.json({ ok: true, name: target.name });
}
