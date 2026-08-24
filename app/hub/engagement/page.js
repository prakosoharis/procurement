import { currentUser } from '../../../lib/current-user';
import { can, Permission } from '../../../lib/authorization/permissions';
import AccountMenu from '../../components/account-menu';
import AssistantPanel from '../../components/assistant-panel';
import { aiConfig } from '../../../lib/ai/config';
import { AiFeatureFlag, isAiFeatureEnabled } from '../../../lib/ai/feature-flags';
import EngagementInsightsPage from './engagement-page';

export const dynamic = 'force-dynamic';

export default async function EngagementPage() {
  const user = await currentUser();
  return <>
    <EngagementInsightsPage role={user?.role || 'USER'} />
    <AccountMenu name={user?.name || 'User'} role={user?.role || 'USER'} />
    {isAiFeatureEnabled(AiFeatureFlag.CHAT) && can(user, Permission.COPILOT_USE) && <AssistantPanel mode={aiConfig().chatMode} />}
  </>;
}
