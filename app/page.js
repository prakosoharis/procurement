import { requireUser } from '../lib/authorization/require-user';
import AccountMenu from './components/account-menu';
import AssistantPanel from './components/assistant-panel';
import { can, Permission } from '../lib/authorization/permissions';
import { aiConfig } from '../lib/ai/config';
import { AiFeatureFlag, isAiFeatureEnabled } from '../lib/ai/feature-flags';
import HomeDashboard from './home/home-dashboard';

export const dynamic = 'force-dynamic';

export default async function Home(){
  const user = await requireUser();
  return <>
    <HomeDashboard role={user.role} />
    <AccountMenu name={user.name} role={user.role} />
    {isAiFeatureEnabled(AiFeatureFlag.CHAT) && can(user, Permission.COPILOT_USE) && <AssistantPanel mode={aiConfig().chatMode} />}
  </>
}
