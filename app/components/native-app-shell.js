import Link from 'next/link';
import AccountMenu from './account-menu';
import { navigationFor } from '../../lib/governance-navigation';
import { roleDisplayName } from '../../lib/authorization/roles';

export default function NativeAppShell({ user, children }) {
  const navigation = navigationFor(user);
  return <>
    <style>{`.top{display:none}.native-app{min-height:100vh;background:#f5f6f8}.native-sidebar{position:fixed;inset:0 auto 0 0;width:252px;background:#fff;border-right:1px solid #e4e7ec;padding:22px 14px;overflow:auto}.native-main{margin-left:252px;min-height:100vh;padding:30px 34px}.native-brand{display:block;padding:7px 10px 20px;color:#991b1b;font-weight:800;font-size:15px}.native-brand small{display:block;color:#667085;font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-top:5px}.native-nav-group{margin:16px 0}.native-nav-label{padding:0 10px 6px;color:#98a2b3;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.native-nav-link{display:block;padding:9px 10px;border-radius:8px;color:#475467;font-size:13px}.native-nav-link:hover{background:#fef2f2;color:#991b1b}.native-topline{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:24px}.native-role{font-size:11px;color:#667085;margin-top:5px}@media(max-width:900px){.native-sidebar{position:static;width:auto;border-right:0;border-bottom:1px solid #e4e7ec;padding:12px;display:flex;gap:8px;overflow:auto}.native-brand{min-width:190px;padding:7px}.native-nav-group{margin:0;display:flex;gap:2px}.native-nav-label{display:none}.native-nav-link{white-space:nowrap}.native-main{margin-left:0;padding:20px 14px}.native-sidebar .native-nav-group:not(:first-of-type){display:none}}`}</style>
    <div className="native-app">
      <a className="skip-link" href="#native-content">Skip to main content</a>
      <aside className="native-sidebar" aria-label="Primary navigation">
        <Link className="native-brand" href="/dashboard">Procurement Governance<small>Native application shell</small></Link>
        {navigation.map((group) => <div className="native-nav-group" key={group.label}><div className="native-nav-label">{group.label}</div>{group.items.map((item) => <Link className="native-nav-link" href={item.href} key={item.href}>{item.label}</Link>)}</div>)}
      </aside>
      <main className="native-main" id="native-content" tabIndex="-1">
        <div className="native-topline"><div><div className="eyebrow" style={{ color: '#991b1b' }}>Procurement SOP Governance Platform</div><div className="native-role">{roleDisplayName(user.role)} · Server-side access policy active</div></div></div>
        {children}
      </main>
      <AccountMenu name={user.name} role={user.role} />
    </div>
  </>;
}
