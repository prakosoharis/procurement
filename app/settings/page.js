import NativeAppShell from '../components/native-app-shell';
import NativeModulePlaceholder from '../components/native-module-placeholder';
import { requirePageAccess } from '../../lib/authorization/require-user';
import { Permission } from '../../lib/authorization/permissions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requirePageAccess(Permission.SETTINGS_MANAGE);
  return <NativeAppShell user={user}><NativeModulePlaceholder title="Settings" description="System configuration, review policy, storage integration status, and provider configuration visibility will be introduced in controlled checkpoints." checkpoint="CP2 onward" legacyNote="CP1 does not change any production integration, storage, or AI configuration." /></NativeAppShell>;
}
