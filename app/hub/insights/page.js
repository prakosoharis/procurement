import { requirePageAccess } from '../../../lib/authorization/require-user';
import { Permission } from '../../../lib/authorization/permissions';
import AccountMenu from '../../components/account-menu';
import { aiConfig } from '../../../lib/ai/config';
import { AiFeatureFlag, isAiFeatureEnabled } from '../../../lib/ai/feature-flags';
import InsightsPage from './insights-page';

export const dynamic = 'force-dynamic';

// The full-page "AI Copilot" chat. Unlike other hub pages, this page IS the
// chat -- it does not also mount the floating AssistantPanel, which would be
// a second, redundant entry point to the same conversation on the same
// screen. Gated on COPILOT_USE (every role) rather than a page permission,
// matching the /api/ai/chat* routes it calls.
export default async function InsightsRoute() {
  const user = await requirePageAccess(Permission.COPILOT_USE);
  return <>
    <InsightsPage aiEnabled={isAiFeatureEnabled(AiFeatureFlag.CHAT)} chatMode={aiConfig().chatMode} role={user.role} name={user.name} />
    <AccountMenu name={user.name || 'User'} role={user.role || 'USER'} />
  </>;
}
