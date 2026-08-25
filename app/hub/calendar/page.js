import { requireUser } from '../../../lib/authorization/require-user';
import { can, Permission } from '../../../lib/authorization/permissions';
import AccountMenu from '../../components/account-menu';
import AssistantPanel from '../../components/assistant-panel';
import { aiConfig } from '../../../lib/ai/config';
import { AiFeatureFlag, isAiFeatureEnabled } from '../../../lib/ai/feature-flags';
import CalendarPage from './calendar-page';

export const dynamic = 'force-dynamic';

export default async function AuditCalendarPage() {
  const user = await requireUser();
  return <>
    <CalendarPage role={user.role} />
    <AccountMenu name={user.name} role={user.role} />
    {isAiFeatureEnabled(AiFeatureFlag.CHAT) && can(user, Permission.COPILOT_USE) && <AssistantPanel mode={aiConfig().chatMode} />}
  </>;
}
