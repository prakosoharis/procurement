import { currentUser } from '../lib/current-user';
import AccountMenu from './components/account-menu';
import AssistantPanel from './components/assistant-panel';
import BlobUploadBridge from './components/blob-upload-bridge';
import { can, Permission } from '../lib/authorization/permissions';
import { aiConfig } from '../lib/ai/config';
import { AiFeatureFlag, isAiFeatureEnabled } from '../lib/ai/feature-flags';

export const dynamic = 'force-dynamic';

export default async function Home(){
  const user = await currentUser();
  return <>
    <BlobUploadBridge />
    <iframe title="Procurement Governance Hub prototype" src={`/procurement-governance-hub.html?v=20260810-05&page=home&role=${encodeURIComponent(user?.role || '')}`} style={{position:'fixed',inset:0,width:'100%',height:'100vh',border:0,zIndex:100}} />
    <AccountMenu name={user?.name || 'User'} role={user?.role || 'USER'} />
    {isAiFeatureEnabled(AiFeatureFlag.CHAT) && can(user, Permission.COPILOT_USE) && <AssistantPanel mode={aiConfig().chatMode} />}
  </>
}
