import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';

export async function GET() {
  const user = await currentUser();
  if (!['SUPER_USER', 'COMPLIANCE_ADMIN'].includes(user?.role)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const users = await db.user.findMany({
    where: { role: { in: user.role === 'SUPER_USER' ? ['BU_PIC', 'COMPLIANCE_REVIEWER', 'COMPLIANCE_ADMIN', 'CORPORATE_PROCUREMENT'] : ['BU_PIC', 'COMPLIANCE_REVIEWER', 'CORPORATE_PROCUREMENT'] } },
    select: { id: true, name: true, email: true, role: true, jobTitle: true, businessUnit: { select: { name: true } } },
    orderBy: [{ role: 'asc' }, { name: 'asc' }]
  });
  return NextResponse.json(users);
}
