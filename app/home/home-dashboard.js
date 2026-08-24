'use client';
import { useEffect, useMemo, useState } from 'react';
import Badge from '../hub/_shared/badge';
import HubHeader from '../hub/_shared/hub-header';
import EngagementComponent, { engagementTone } from '../hub/_shared/engagement-component';
import { BG, BORDER, CARD, FG, MUTED, PRIMARY } from '../hub/_shared/tokens';

// Faithful React port of the static hub's Home page. Content that was
// hardcoded demo data in the HTML (hero slides, document counts, calendar
// preview, risk snapshot, executive summary) is reproduced as the SAME
// hardcoded data here -- a framework port, not a redesign. The "BU Engagement
// Index" card is the one section that was already wired to real data
// (GET /api/engagement) in the static version; that wiring is preserved.

const SLIDES = [
  { badge: 'EXTERNAL AUDIT', title: 'BU Berau Coal — Audit by Deloitte', desc: 'BU Berau Coal will undergo an external audit conducted by Deloitte, scheduled for August and September 2026.', cta1: 'View Schedule', cta2: 'Prepare Documents', img: 'https://images.fillout.com/749243/1b2pundmnc/generated-images/f6kaNVU8qH4jbDhj9wfFhp/img_FXQNn_z4oCwS9P49.jpg' },
  { badge: 'REGULATORY UPDATE', title: 'POJK No. 12/2026 — New Procurement Guidelines', desc: 'New procurement regulations have been published by OJK. Review the impact on your business unit SOPs.', cta1: 'View Details', cta2: 'Run Gap Analysis', img: 'https://images.fillout.com/749243/1b2pundmnc/generated-images/dFChzLCGpaR7tKsK7RVBxK/img_4LweBzUwzR6-IJYo.jpg' },
  { badge: 'Q3 AUDIT PREP', title: 'Q3 On-site Audit Schedule Published', desc: 'Prepare documentation for upcoming audit visits. BU Logistics and Finance are scheduled first.', cta1: 'See Schedule', cta2: 'Prepare Docs', img: 'https://images.fillout.com/749243/1b2pundmnc/generated-images/h63RPchwF3AjP9MgXR6ijT/img_CH4r1c81lDQ3kWpM.jpg' }
];

const RISK_DATA = [
  { label: 'Overdue Actions', value: 12, color: 'hsl(0,72%,51%)' },
  { label: 'Pending Validations', value: 7, color: 'hsl(38,92%,50%)' },
  { label: 'Policy Exceptions', value: 3, color: 'hsl(220,65%,45%)' },
  { label: 'Other Risks', value: 2, color: 'hsl(220,12%,75%)' }
];

const BU_LOGOS = [
  ['Bank Sinarmas', 'https://images.fillout.com/orgid-749243/flowpublicid-1b2pundmnc/widgetid-default/sYxwSp7vGGdSsE2tYHAMKB/pasted-image-1783920957212-7iucmnvn.jpg'],
  ['Eber Petrochemical', 'https://images.fillout.com/orgid-749243/flowpublicid-1b2pundmnc/widgetid-default/q22AvdFdSqBzJNVtvhcunJ/pasted-image-1783920957234-eeqmmlm6.jpeg'],
  ['Golden Energy', 'https://images.fillout.com/orgid-749243/flowpublicid-1b2pundmnc/widgetid-default/aMKYMXrosihUUkQqUdk8Di/pasted-image-1783920957249-94v82s3u.webp'],
  ['GEMS', 'https://images.fillout.com/orgid-749243/flowpublicid-1b2pundmnc/widgetid-default/mkFv82AFVYvMfoUam4gZxK/pasted-image-1783920957267-ik998rr1.jpg'],
  ['Berau Coal', 'https://images.fillout.com/orgid-749243/flowpublicid-1b2pundmnc/widgetid-default/pzP9YPsxFApt1ZzbjfSwxn/pasted-image-1783920957282-49ls3n77.jpg'],
  ['Sinarmas C&T', 'https://images.fillout.com/orgid-749243/flowpublicid-1b2pundmnc/widgetid-default/hDHTon2B7HXQoEGHUMsosT/pasted-image-1784018920486-u9o206m4.jpg'],
  ['SMART', 'https://images.fillout.com/orgid-749243/flowpublicid-1b2pundmnc/widgetid-default/bccM8CXcRT55WF7xHgB3FT/pasted-image-1784018920516-y8kpa03t.jpg'],
  ['ABL', 'https://images.fillout.com/orgid-749243/flowpublicid-1b2pundmnc/widgetid-default/9vyEPmHPGTezYzteLfUPei/pasted-image-1784018920537-5r536yth.jpg'],
  ['Viva Pharma', 'https://images.fillout.com/orgid-749243/flowpublicid-1b2pundmnc/widgetid-default/w19e74CFaZMgrjCdXmcCeK/pasted-image-1784018920556-sw7o5hzs.jpg'],
  ['PYFA Group', 'https://images.fillout.com/orgid-749243/flowpublicid-1b2pundmnc/widgetid-default/bUL99QLm7eJEjAyukVmixo/pasted-image-1784018920572-rf8cn364.jpg'],
  ['Win&Co', 'https://images.fillout.com/orgid-749243/flowpublicid-1b2pundmnc/widgetid-default/8F5YqAjQzvQVRv5GT2VtHz/pasted-image-1784018920590-p5zek7sk.jpg']
];

function Card({ children, style }) {
  return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 4px 12px -1px rgba(0,0,0,0.07)', ...style }}>{children}</div>;
}

function HeroCarousel() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((current) => (current + 1) % SLIDES.length), 6000);
    return () => clearInterval(timer);
  }, []);
  const slide = SLIDES[index];
  return <Card style={{ position: 'relative', minHeight: 280, overflow: 'hidden', color: '#fff' }}>
    <img src={slide.img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,12,20,.85), rgba(10,12,20,.15))' }} />
    <div style={{ position: 'relative', padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 280 }}>
      <span style={{ alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, letterSpacing: .4, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,.15)', marginBottom: 10 }}>{slide.badge}</span>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{slide.title}</h2>
      <p style={{ fontSize: 13, opacity: .9, maxWidth: 520, marginBottom: 16 }}>{slide.desc}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ padding: '0 16px', height: 36, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{slide.cta1}</button>
        <button style={{ padding: '0 16px', height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,.5)', background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{slide.cta2}</button>
      </div>
    </div>
    <button onClick={() => setIndex((index - 1 + SLIDES.length) % SLIDES.length)} aria-label="Sebelumnya" style={{ position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.2)', color: '#fff', cursor: 'pointer' }}>‹</button>
    <button onClick={() => setIndex((index + 1) % SLIDES.length)} aria-label="Berikutnya" style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.2)', color: '#fff', cursor: 'pointer' }}>›</button>
    <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
      {SLIDES.map((_, i) => <span key={i} onClick={() => setIndex(i)} style={{ width: 6, height: 6, borderRadius: '50%', cursor: 'pointer', background: i === index ? '#fff' : 'rgba(255,255,255,.4)' }} />)}
    </div>
  </Card>;
}

function RiskDonut() {
  const total = RISK_DATA.reduce((sum, d) => sum + d.value, 0);
  let angle = -90;
  const gap = 1.5;
  const segments = RISK_DATA.map((d) => {
    const sweep = (d.value / total) * 360 - gap;
    const seg = { ...d, start: angle, sweep };
    angle += sweep + gap;
    return seg;
  });
  // Rounded to 4 decimals: Math.cos/Math.sin can differ in their last float
  // bit between the server and browser JS engines, which otherwise makes the
  // SSR-ed path `d` attribute mismatch the client re-render byte-for-byte and
  // trips a permanent React hydration warning for a visually meaningless
  // sub-pixel difference.
  const round = (n) => Math.round(n * 10_000) / 10_000;
  const polarToXY = (cx, cy, r, deg) => { const rad = (deg * Math.PI) / 180; return [round(cx + r * Math.cos(rad)), round(cy + r * Math.sin(rad))]; };
  const arcPath = (cx, cy, outer, inner, start, sweep) => {
    const [x1, y1] = polarToXY(cx, cy, outer, start), [x2, y2] = polarToXY(cx, cy, outer, start + sweep);
    const [x3, y3] = polarToXY(cx, cy, inner, start + sweep), [x4, y4] = polarToXY(cx, cy, inner, start);
    const large = sweep > 180 ? 1 : 0;
    return `M${x1},${y1} A${outer},${outer} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${inner},${inner} 0 ${large} 0 ${x4},${y4} Z`;
  };
  return <div style={{ position: 'relative', width: 112, height: 112, flexShrink: 0 }}>
    <svg width="112" height="112" viewBox="0 0 112 112">
      {segments.map((seg) => <path key={seg.label} d={arcPath(56, 56, 52, 32, seg.start, seg.sweep)} fill={seg.color} />)}
    </svg>
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 22, fontWeight: 800, color: FG }}>{total}</span>
      <span style={{ fontSize: 8, color: MUTED, textAlign: 'center', maxWidth: 60 }}>Total High-Risk</span>
    </div>
  </div>;
}

function EngagementDashboard() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/engagement').then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat engagement');
      setPayload(data);
    }).catch((err) => setError(err.message));
  }, []);

  if (error) return <Card style={{ padding: 20, marginTop: 20, fontSize: 13, color: MUTED }}>BU Engagement Index belum dapat dimuat. Silakan refresh halaman.</Card>;
  if (!payload) return <Card style={{ padding: 20, marginTop: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div><h3 style={{ fontSize: 16 }}>BU Engagement Index</h3><p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Empat indikator setara untuk memantau partisipasi Business Unit selama 30 hari terakhir.</p></div>
      <Badge>Memuat data…</Badge>
    </div>
  </Card>;

  const units = payload.units || [];
  const isBU = payload.viewer?.role === 'BUSINESS_UNIT_PIC';

  if (isBU) {
    const unit = units[0];
    if (!unit) return <Card style={{ padding: 20, marginTop: 20, fontSize: 13, color: MUTED }}>Business Unit Anda belum terhubung ke data engagement.</Card>;
    const c = unit.components;
    const priorities = [];
    if (c.documents.approved < c.documents.total) priorities.push(`Lengkapi ${c.documents.total - c.documents.approved} dokumen mandatory yang belum disetujui.`);
    if (c.submissions.overdueRevisions) priorities.push(`Respons ${c.submissions.overdueRevisions} submission revisi yang sudah melewati 3 hari.`);
    if (c.calendar.invited > c.calendar.confirmed + c.calendar.attended) priorities.push('Konfirmasi kehadiran pada event Calendar yang melibatkan Anda.');
    if (c.activity.activePics < c.activity.totalPics) priorities.push('Pastikan PIC aktif menggunakan aplikasi selama periode berjalan.');

    return <Card style={{ padding: 20, marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div><h3 style={{ fontSize: 16 }}>Engagement Business Unit Anda</h3><p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Periode {payload.period.days} hari terakhir · diperbarui otomatis</p></div>
        <Badge tone={unit.score >= 80 ? 'green' : unit.score >= 60 ? 'amber' : 'red'}>{unit.level.replace(/_/g, ' ')}</Badge>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,.7fr) 2fr', gap: 16, marginTop: 16, alignItems: 'stretch' }}>
        <div style={{ borderRadius: 12, background: '#fff7ed', padding: 18, textAlign: 'center', border: '1px solid #fed7aa' }}>
          <div style={{ fontSize: 11, color: '#9a3412', fontWeight: 700 }}>SKOR ENGAGEMENT</div>
          <div style={{ fontSize: 42, lineHeight: 1, fontWeight: 800, color: engagementTone(unit.score), marginTop: 8 }}>{unit.score}</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>dari 100</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
          <EngagementComponent label="Document Compliance" health={c.documents.health} description={`${c.documents.approved}/${c.documents.total} mandatory disetujui`} />
          <EngagementComponent label="Submission Responsiveness" health={c.submissions.health} description={`${c.submissions.overdueRevisions} revisi melewati SLA`} />
          <EngagementComponent label="Calendar Participation" health={c.calendar.health} description={`${c.calendar.confirmed + c.calendar.attended}/${c.calendar.invited} event dikonfirmasi`} />
          <EngagementComponent label="Meaningful Activity" health={c.activity.health} description={`${c.activity.activePics}/${c.activity.totalPics} PIC aktif`} />
        </div>
      </div>
      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 9, background: BG, fontSize: 12 }}>
        <b>Prioritas berikutnya</b>
        <div style={{ marginTop: 5, color: MUTED }}>
          {priorities.length ? priorities.map((item, i) => <div key={i}>• {item}</div>) : 'Semua indikator berada dalam kondisi baik. Pertahankan konsistensi partisipasi Anda.'}
        </div>
      </div>
    </Card>;
  }

  const overview = payload.overview;
  const ranking = units.slice(0, 6);
  return <Card style={{ padding: 20, marginTop: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div><h3 style={{ fontSize: 16 }}>BU Engagement Index</h3><p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Skor 0–100 dari kepatuhan dokumen, respons submission, partisipasi calendar, dan aktivitas PIC · {payload.period.days} hari terakhir.</p></div>
      <a href="/hub/insights" style={{ padding: '0 12px', height: 32, display: 'inline-flex', alignItems: 'center', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 12, color: FG }}>Lihat insight</a>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(120px,1fr))', gap: 10, marginTop: 16 }}>
      <div style={{ padding: 12, border: `1px solid ${BORDER}`, borderRadius: 9 }}><div style={{ fontSize: 11, color: MUTED }}>Rata-rata BU</div><b style={{ fontSize: 25, color: engagementTone(overview.averageScore) }}>{overview.averageScore}</b><span style={{ fontSize: 11, color: MUTED }}> /100</span></div>
      <div style={{ padding: 12, border: `1px solid ${BORDER}`, borderRadius: 9 }}><div style={{ fontSize: 11, color: MUTED }}>BU terpantau</div><b style={{ fontSize: 25 }}>{overview.totalBusinessUnits}</b></div>
      <div style={{ padding: 12, border: `1px solid ${BORDER}`, borderRadius: 9 }}><div style={{ fontSize: 11, color: MUTED }}>Engagement tinggi</div><b style={{ fontSize: 25, color: '#15803d' }}>{overview.highEngagement}</b></div>
      <div style={{ padding: 12, border: `1px solid ${BORDER}`, borderRadius: 9 }}><div style={{ fontSize: 11, color: MUTED }}>Perlu perhatian</div><b style={{ fontSize: 25, color: '#b91c1c' }}>{overview.needsAttention}</b></div>
    </div>
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 7 }}>Peringkat Business Unit</div>
      {ranking.map((unit, index) => (
        <div key={unit.id} style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) 58px', alignItems: 'center', gap: 9, padding: '9px 0', borderTop: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 12, color: MUTED }}>{index + 1}</span>
          <div>
            <b style={{ fontSize: 12 }}>{unit.name}</b><span style={{ fontSize: 11, color: MUTED }}> · {unit.industry || '—'}</span>
            <div style={{ height: 6, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden', marginTop: 7 }}><div style={{ height: '100%', width: `${unit.score}%`, background: engagementTone(unit.score) }} /></div>
          </div>
          <b style={{ fontSize: 13, textAlign: 'right', color: engagementTone(unit.score) }}>{unit.score}</b>
        </div>
      ))}
      {units.length > 6 && <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>Menampilkan 6 dari {units.length} Business Unit.</div>}
    </div>
  </Card>;
}

const QUICK_ACTIONS = [
  { key: 'exception', icon: '📄', title: 'Request for Exception', sub: 'Ajukan pengecualian', href: '/hub/requests', roles: ['BUSINESS_UNIT_PIC', 'SUPER_USER'] },
  { key: 'upload', icon: '📤', title: 'Upload / Update SOP', sub: 'Admin & Tim Compliance', href: '/hub/repository', roles: ['SUPER_USER', 'CORPORATE_GOVERNANCE'] },
  { key: 'actions', icon: '📋', title: 'View My Actions', sub: 'Ask AI Copilot', href: '/hub/insights', roles: null },
  { key: 'todos', icon: '☑️', title: 'My To-Dos', sub: '3 actions due this week', href: '/hub/requests', roles: null },
  { key: 'copilot', icon: '🤖', title: 'AI Copilot', sub: 'Ask strategic or task questions', href: '/hub/insights', roles: null, accent: true }
];

export default function HomeDashboard({ role }) {
  const visibleActions = useMemo(() => QUICK_ACTIONS.filter((action) => !action.roles || action.roles.includes(role)), [role]);

  return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader active="home" role={role} />
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
        <HeroCarousel />
        <Card style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Document & Reference Center</h3>
          <p style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>Quick search across SOPs, regulations, audit findings.</p>
          <input placeholder="Search documents, SOPs, regulations..." style={{ fontSize: 13, padding: '0 12px', height: 36, borderRadius: 10, border: `1px solid ${BORDER}`, marginBottom: 20 }} />
          {[['Procurement SOPs', 86, PRIMARY], ['Regulations', 42, 'hsl(220,65%,45%)'], ['Audit Findings', 18, 'hsl(38,92%,50%)']].map(([label, count, color]) => (
            <button key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 8, textAlign: 'left' }}>
              <span style={{ fontSize: 14, color }}>📄</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: FG }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color }}>{count}</span>
            </button>
          ))}
        </Card>
      </div>

      <Card style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, background: '#fff7ed', border: '1px solid #fed7aa' }}>
        <span>📣</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: PRIMARY }}>ANNOUNCEMENT</span>
        <span style={{ color: MUTED }}>•</span>
        <p style={{ fontSize: 13, color: FG, flex: 1 }}>Q3 audit visit schedule is now available. BU Logistics, Finance, and Distribution should prepare required documents by 31 July.</p>
        <span style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, cursor: 'pointer', flexShrink: 0 }}>View all ›</span>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleActions.length}, minmax(0,1fr))`, gap: 12 }}>
        {visibleActions.map((action) => (
          <a key={action.key} href={action.href} style={{
            display: 'block', padding: 16, borderRadius: 12, border: `1px solid ${BORDER}`,
            background: action.accent ? PRIMARY : CARD, color: action.accent ? '#fff' : FG, cursor: 'pointer'
          }}>
            <div style={{ fontSize: 20 }}>{action.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>{action.title}</div>
            <div style={{ fontSize: 11, color: action.accent ? 'rgba(255,255,255,.85)' : MUTED, marginTop: 2 }}>{action.sub}</div>
          </a>
        ))}
      </div>

      <EngagementDashboard />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
        <Card style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><h3 style={{ fontSize: 14 }}>Audit Calendar</h3><a href="/hub/calendar" style={{ fontSize: 11, color: PRIMARY, fontWeight: 600 }}>View all</a></div>
          <div style={{ fontSize: 11, color: MUTED, margin: '8px 0' }}>📅 Upcoming audit visits</div>
          {[['JUN', '24', 'BU Logistics', 'On-site Audit'], ['JUL', '07', 'BU Finance', 'On-site Audit'], ['JUL', '21', 'BU Distribution', 'Remote Audit']].map(([month, day, name, type]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${BORDER}` }}>
              <div style={{ textAlign: 'center', width: 34 }}><div style={{ fontSize: 9, color: MUTED, fontWeight: 700 }}>{month}</div><div style={{ fontSize: 14, fontWeight: 700 }}>{day}</div></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{name}</div><div style={{ fontSize: 10, color: MUTED }}>{type}</div></div>
              <Badge>Scheduled</Badge>
            </div>
          ))}
          <a href="/hub/calendar" style={{ display: 'block', fontSize: 11, color: PRIMARY, fontWeight: 600, marginTop: 10 }}>See full calendar ›</a>
        </Card>

        <Card style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><h3 style={{ fontSize: 14 }}>Procurement Insights</h3><span style={{ fontSize: 11, color: PRIMARY, fontWeight: 600 }}>View all</span></div>
          <div style={{ fontSize: 11, color: MUTED, margin: '8px 0' }}>📈 What's new & important</div>
          {[['📚', 'Q3 Governance Workshop', 'Register by 20 June'], ['⚠️', 'New Regulatory Update', 'Effective 15 June 2025'], ['✅', 'External Thought Leadership', 'AI in Procurement Governance']].map(([icon, title, sub]) => (
            <div key={title} style={{ display: 'flex', gap: 8, padding: '8px 0', borderTop: `1px solid ${BORDER}` }}>
              <span>{icon}</span>
              <div><div style={{ fontSize: 12, fontWeight: 600 }}>{title}</div><div style={{ fontSize: 10, color: MUTED }}>{sub}</div></div>
            </div>
          ))}
        </Card>

        <Card style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><h3 style={{ fontSize: 14 }}>Risk Snapshot</h3><span style={{ fontSize: 11, color: PRIMARY, fontWeight: 600 }}>View all</span></div>
          <div style={{ fontSize: 11, color: MUTED, margin: '8px 0' }}>🛡️ High-risk items requiring attention</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <RiskDonut />
            <div style={{ flex: 1 }}>
              {RISK_DATA.map((d) => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                  <span style={{ flex: 1, color: FG }}>{d.label}</span>
                  <span style={{ fontWeight: 700 }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: '#b91c1c', fontWeight: 500 }}>⚠️ 5 items are overdue</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: PRIMARY }}>View all risks ›</span>
          </div>
        </Card>

        <Card style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><h3 style={{ fontSize: 14 }}>Executive Summary</h3><span style={{ fontSize: 11, color: PRIMARY, fontWeight: 600 }}>View all</span></div>
          <div style={{ fontSize: 11, color: MUTED, margin: '8px 0' }}>📊 Top priorities & regulatory impact</div>
          {[['⚠️', '#fee2e2', '#b91c1c', 'Top BU Risks', '12 high-impact risks need mitigation'], ['⚖️', '#fef3c7', '#b45309', 'Regulatory Impact', '3 new regulations this month'], ['📈', '#dcfce7', '#15803d', 'Compliance Health', '87% overall compliance score']].map(([icon, bg, fg, title, sub]) => (
            <div key={title} style={{ display: 'flex', gap: 8, padding: '8px 0', borderTop: `1px solid ${BORDER}` }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{icon}</span>
              <div><div style={{ fontSize: 12, fontWeight: 600 }}>{title}</div><div style={{ fontSize: 10, color: MUTED }}>{sub}</div></div>
            </div>
          ))}
        </Card>
      </div>

      <Card style={{ padding: 20, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(153,27,27,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏢</div>
          <div><div style={{ fontWeight: 700, fontSize: 14 }}>Participating Business Units</div><div style={{ fontSize: 10, color: MUTED }}>Corporate entities using this governance platform</div></div>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          {BU_LOGOS.map(([name, src]) => <img key={name} src={src} alt={name} title={name} style={{ height: 32, objectFit: 'contain', filter: 'grayscale(1)', opacity: .7 }} />)}
        </div>
      </Card>
    </div>
  </div>;
}
