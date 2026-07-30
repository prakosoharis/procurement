import NativeAppShell from '../../components/native-app-shell';
import { requirePageAccess } from '../../../lib/authorization/require-user';
import { Permission } from '../../../lib/authorization/permissions';

export const dynamic = 'force-dynamic';

export default async function RepositoryLayout({ children }) {
  const user = await requirePageAccess(Permission.SOP_REPOSITORY_VIEW);
  return <NativeAppShell user={user}>{children}</NativeAppShell>;
}
