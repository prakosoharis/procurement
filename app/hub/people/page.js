import { requirePageAccess } from '../../../lib/authorization/require-user';
import { can, Permission } from '../../../lib/authorization/permissions';
import AccountMenu from '../../components/account-menu';
import AssistantPanel from '../../components/assistant-panel';
import { aiConfig } from '../../../lib/ai/config';
import { AiFeatureFlag, isAiFeatureEnabled } from '../../../lib/ai/feature-flags';
import PeoplePage from './people-page';

export const dynamic = 'force-dynamic';

export default async function PeopleRoute() {
  const user = await requirePageAccess(Permission.PEOPLE_VIEW);
  return <>
    <PeoplePage role={user.role} />
    <AccountMenu name={user?.name || 'User'} role={user?.role || 'USER'} />
    {isAiFeatureEnabled(AiFeatureFlag.CHAT) && can(user, Permission.COPILOT_USE) && <AssistantPanel mode={aiConfig().chatMode} />}
  </>;
}
