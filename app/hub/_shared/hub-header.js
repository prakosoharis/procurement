import { BORDER, CARD, FG, MUTED, PRIMARY, PRIMARY_SOFT } from './tokens';

// Reproduces the approved static hub's header chrome (logo + nav) as real
// Next.js navigation, without the account-menu duplication that markup had --
// AccountMenu is mounted once, separately, by each page.js and floats fixed
// above whichever hub screen is active.
const NAV_ITEMS = [
  ['home', 'Home', '/'],
  ['repository', 'Repository', '/hub/repository'],
  ['refinement', 'Refinement', '/hub/refinement'],
  ['calendar', 'Calendar', '/hub/calendar'],
  ['engagement', 'Engagement', '/hub/engagement'],
  ['insights', 'Insights', '/hub/insights'],
  ['people', 'People', '/hub/people'],
  ['directory', 'Directory', '/hub/directory']
];

export default function HubHeader({ active, role }) {
  // The approved static hub hides Directory's nav link for Business Unit
  // PICs ([data-directory-menu], applyDashboardRole()) -- the page itself
  // stays reachable by URL for that role, only the link is hidden.
  const items = NAV_ITEMS.filter(([key]) => key !== 'directory' || role !== 'BUSINESS_UNIT_PIC');
  return <header style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, zIndex: 50 }}>
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', gap: 16 }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: FG }}>Procurement Governance Hub</span>
      </a>
      <nav style={{ display: 'flex', gap: 2, marginLeft: 24 }}>
        {items.map(([key, label, href]) => (
          <a key={key} href={href} style={{
            padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
            color: key === active ? PRIMARY : MUTED, background: key === active ? PRIMARY_SOFT : 'transparent'
          }}>{label}</a>
        ))}
      </nav>
    </div>
  </header>;
}
