import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';

export async function GET() {
  const user = await currentUser();
  if (user?.role !== 'COMPLIANCE_ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const users = await db.user.findMany({
    where: { role: { in: ['BU_PIC', 'COMPLIANCE_REVIEWER', 'CORPORATE_PROCUREMENT'] } },
    select: { id: true, name: true, email: true, role: true, jobTitle: true, businessUnit: { select: { name: true } } },
    orderBy: [{ role: 'asc' }, { name: 'asc' }]
  });
  return NextResponse.json(users);
}
