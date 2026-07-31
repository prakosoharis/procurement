import NativeAppShell from '../../components/native-app-shell';
import { requirePageAccess } from '../../../lib/authorization/require-user';
import { Permission } from '../../../lib/authorization/permissions';

export const dynamic = 'force-dynamic';

export default async function RefinementLayout({ children }) {
  const user = await requirePageAccess(Permission.REFINEMENT_VIEW);
  return <NativeAppShell user={user}>{children}</NativeAppShell>;
}
