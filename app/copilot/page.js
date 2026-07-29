import NativeAppShell from '../components/native-app-shell';
import NativeModulePlaceholder from '../components/native-module-placeholder';
import { requirePageAccess } from '../../lib/authorization/require-user';
import { Permission } from '../../lib/authorization/permissions';

export const dynamic = 'force-dynamic';

export default async function CopilotPage() {
  const user = await requirePageAccess(Permission.COPILOT_USE);
  return <NativeAppShell user={user}><NativeModulePlaceholder title="AI Copilot" description="The procurement-only copilot will be introduced after provider abstraction, permission-filtered retrieval, usage tracking, and safety controls are implemented." checkpoint="CP10" legacyNote="The existing simulated legacy copilot is not extended in CP1." /></NativeAppShell>;
}
