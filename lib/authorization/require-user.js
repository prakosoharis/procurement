import { redirect } from 'next/navigation';
import { currentUser } from '../current-user';
import { can } from './permissions';

export async function requirePageAccess(permission) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (!can(user, permission)) redirect('/');
  return user;
}
