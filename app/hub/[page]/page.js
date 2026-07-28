import { notFound } from 'next/navigation';
import { currentUser } from '../../../lib/current-user';
import AccountMenu from '../../components/account-menu';

const pages = new Set(['requests', 'repository', 'refinement', 'calendar', 'engagement', 'insights', 'directory']);
export const dynamic = 'force-dynamic';

export default async function HubPage({ params }) {
  const { page } = await params;
  if (!pages.has(page)) notFound();
  const user = await currentUser();
  return <>
    <iframe title={`Procurement Governance Hub - ${page}`} src={`/procurement-governance-hub.html?v=20260728-34&page=${encodeURIComponent(page)}&role=${encodeURIComponent(user?.role || '')}`} style={{ position: 'fixed', inset: 0, width: '100%', height: '100vh', border: 0, zIndex: 100 }} />
    <AccountMenu name={user?.name || 'User'} role={user?.role || 'USER'} />
  </>;
}
