import { redirect } from 'next/navigation';
import { currentUser } from '../current-user';
import { can } from './permissions';

export async function requirePageAccess(permission) {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (!can(user, permission)) redirect('/');
  return user;
}

// For pages every authenticated role may view (no specific Permission to
// gate by). Still redirects to /login when there is no session -- middleware
// only checks that the session cookie is present, not that it is still
// valid, so an expired 8h session must be caught here or the page silently
// renders with a fallback "USER" role instead of sending the visitor to log
// in again.
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}
