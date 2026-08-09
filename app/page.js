import { currentUser } from '../lib/current-user';
import AccountMenu from './components/account-menu';
import BlobUploadBridge from './components/blob-upload-bridge';

export const dynamic = 'force-dynamic';

export default async function Home(){
  const user = await currentUser();
  return <>
    <BlobUploadBridge />
    <iframe title="Procurement Governance Hub prototype" src={`/procurement-governance-hub.html?v=20260810-04&page=home&role=${encodeURIComponent(user?.role || '')}`} style={{position:'fixed',inset:0,width:'100%',height:'100vh',border:0,zIndex:100}} />
    <AccountMenu name={user?.name || 'User'} role={user?.role || 'USER'} />
  </>
}
