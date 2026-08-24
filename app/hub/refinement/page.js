import { requirePageAccess } from '../../../lib/authorization/require-user';
import { can, Permission } from '../../../lib/authorization/permissions';
import AccountMenu from '../../components/account-menu';
import AssistantPanel from '../../components/assistant-panel';
import { aiConfig } from '../../../lib/ai/config';
import { AiFeatureFlag, isAiFeatureEnabled } from '../../../lib/ai/feature-flags';
import RefinementWorkbench from './refinement-workbench';

// A dedicated React page for AI-assisted Refinement, not the static hub asset
// rendered in an iframe. Every other hub page keeps using the iframe; this is
// the one screen with genuinely new functionality (start an AI analysis,
// review candidate findings, record a human decision) that the static asset
// has no equivalent for -- its Refinement tab remains demo markup.
export const dynamic = 'force-dynamic';

export default async function RefinementPage() {
  const user = await requirePageAccess(Permission.REFINEMENT_VIEW);
  return <>
    <RefinementWorkbench role={user.role} userName={user.name} />
    <AccountMenu name={user?.name || 'User'} role={user?.role || 'USER'} />
    {isAiFeatureEnabled(AiFeatureFlag.CHAT) && can(user, Permission.COPILOT_USE) && <AssistantPanel mode={aiConfig().chatMode} />}
  </>;
}
