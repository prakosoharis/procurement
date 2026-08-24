import { requirePageAccess } from '../../../lib/authorization/require-user';
import { can, Permission } from '../../../lib/authorization/permissions';
import AccountMenu from '../../components/account-menu';
import AssistantPanel from '../../components/assistant-panel';
import { aiConfig } from '../../../lib/ai/config';
import { AiFeatureFlag, isAiFeatureEnabled } from '../../../lib/ai/feature-flags';
import RepositoryPage from './repository-page';

export const dynamic = 'force-dynamic';

export default async function RepositoryRoute() {
  const user = await requirePageAccess(Permission.SOP_REPOSITORY_VIEW);
  return <>
    <RepositoryPage role={user.role} viewerId={user.id} />
    <AccountMenu name={user?.name || 'User'} role={user?.role || 'USER'} />
    {isAiFeatureEnabled(AiFeatureFlag.CHAT) && can(user, Permission.COPILOT_USE) && <AssistantPanel mode={aiConfig().chatMode} />}
  </>;
}
