import { notFound } from 'next/navigation';
import { currentUser } from '../../../lib/current-user';
import AccountMenu from '../../components/account-menu';
import AssistantPanel from '../../components/assistant-panel';
import BlobUploadBridge from '../../components/blob-upload-bridge';
import { aiConfig } from '../../../lib/ai/config';
import { AiFeatureFlag, isAiFeatureEnabled } from '../../../lib/ai/feature-flags';
import { can, Permission } from '../../../lib/authorization/permissions';

// 'refinement' is intentionally absent: app/hub/refinement/page.js is a
// static route at the same path and Next.js gives it priority over this
// dynamic [page] route, so it is never reached for that value. Listing it
// here too would be misleading about which file actually serves it.
const pages = new Set(['requests']);
export const dynamic = 'force-dynamic';

export default async function HubPage({ params }) {
  const { page } = await params;
  if (!pages.has(page)) notFound();
  const user = await currentUser();
  return <>
    <BlobUploadBridge />
    <iframe title={`Procurement Governance Hub - ${page}`} src={`/procurement-governance-hub.html?v=20260810-05&page=${encodeURIComponent(page)}&role=${encodeURIComponent(user?.role || '')}`} style={{ position: 'fixed', inset: 0, width: '100%', height: '100vh', border: 0, zIndex: 100 }} />
    <AccountMenu name={user?.name || 'User'} role={user?.role || 'USER'} />
    {isAiFeatureEnabled(AiFeatureFlag.CHAT) && can(user, Permission.COPILOT_USE) && <AssistantPanel mode={aiConfig().chatMode} />}
  </>;
}
