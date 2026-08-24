import { currentUser } from '../../../lib/current-user';
import { can, Permission } from '../../../lib/authorization/permissions';
import AccountMenu from '../../components/account-menu';
import AssistantPanel from '../../components/assistant-panel';
import { aiConfig } from '../../../lib/ai/config';
import { AiFeatureFlag, isAiFeatureEnabled } from '../../../lib/ai/feature-flags';
import DirectoryPage from './directory-page';

export const dynamic = 'force-dynamic';

// No page-level permission gate, matching the static asset: every role can
// view Directory by URL, only the nav LINK is hidden for Business Unit PICs
// (see app/hub/_shared/hub-header.js). Admin actions (create user, reset
// password) are gated inline by role, same as the original.
export default async function DirectoryRoute() {
  const user = await currentUser();
  return <>
    <DirectoryPage role={user?.role || 'USER'} />
    <AccountMenu name={user?.name || 'User'} role={user?.role || 'USER'} />
    {isAiFeatureEnabled(AiFeatureFlag.CHAT) && can(user, Permission.COPILOT_USE) && <AssistantPanel mode={aiConfig().chatMode} />}
  </>;
}
