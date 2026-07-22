import { cookies } from 'next/headers';
import { db } from './db';
import { readSession } from './auth';
export async function currentUser(){const token=(await cookies()).get('session')?.value;if(!token)return null;const session=await readSession(token);return session?.sub?db.user.findUnique({where:{id:session.sub},include:{businessUnit:true}}):null}
export function canReview(user){return user&&['COMPLIANCE_ADMIN','COMPLIANCE_REVIEWER','CORPORATE_PROCUREMENT'].includes(user.role)}
export function canManageReferences(user){return user&&['COMPLIANCE_ADMIN','COMPLIANCE_REVIEWER'].includes(user.role)}
