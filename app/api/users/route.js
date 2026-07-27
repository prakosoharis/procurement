import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';

export async function GET() {
  const user = await currentUser();
  if (!['SUPER_USER', 'CORPORATE_GOVERNANCE'].includes(user?.role)) return NextResponse.json({ error: 'Corporate Governance access required' }, { status: 403 });
  const users = await db.user.findMany({
    where: { role: { in: user.role === 'SUPER_USER' ? ['BUSINESS_UNIT_PIC', 'CORPORATE_GOVERNANCE'] : ['BUSINESS_UNIT_PIC'] } },
    select: { id: true, name: true, email: true, role: true, jobTitle: true, businessUnit: { select: { name: true } } },
    orderBy: [{ role: 'asc' }, { name: 'asc' }]
  });
  return NextResponse.json(users);
}
