import NativeAppShell from '../components/native-app-shell';
import NativeModulePlaceholder from '../components/native-module-placeholder';
import { requirePageAccess } from '../../lib/authorization/require-user';
import { Permission } from '../../lib/authorization/permissions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requirePageAccess(Permission.DASHBOARD_VIEW);
  return <NativeAppShell user={user}><NativeModulePlaceholder title="Dashboard" description="Executive and operational governance visibility will move here incrementally. The existing dashboard remains available in the legacy application until its native replacement is implemented." checkpoint="CP11" legacyNote="The legacy dashboard continues to serve existing users; CP1 only establishes the native route and access policy." /></NativeAppShell>;
}
