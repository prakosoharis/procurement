'use client';
import { useState } from 'react';
import Badge from '../_shared/badge';
import { BORDER, CARD, FG, MUTED, PRIMARY } from '../_shared/tokens';

// Faithful visual port of the static hub's "Hubungan SOP & Sumber" tab --
// 100% hardcoded demo content there (no ids, no fetch, "+ Hubungkan Sumber"
// has no handler), ported as-is rather than wired up. Only the sidebar
// selection (which SOP's relationships are shown) is real client state,
// since that's a pure display concern the original also had (via a CSS
// .active class toggle), not a claim about live data.

const ITEMS = [
  { title: 'SOP Pengadaan Barang & Jasa', sub: 'BU Logistik A · 4 sumber aktif', sources: [
    { title: 'POJK No. 12/2026', desc: 'Regulation · v2026.05 · Mengatur tender terbuka, evaluasi kualifikasi, dan pelaporan.' },
    { title: 'Best Practice Procurement 2026', desc: 'Best Practice · v2026 · Menjadi pembanding kontrol proses procurement modern.' },
    { title: 'Audit Finding Procurement Q2', desc: 'Audit Finding · Q2 2026 · Dipakai untuk validasi area kontrol yang lemah.' }
  ] },
  { title: 'SOP Manajemen Vendor', sub: 'Corporate Procurement · 3 sumber aktif', sources: [
    { title: 'POJK No. 12/2026', desc: 'Regulation · v2026.05 · Mengatur tender terbuka, evaluasi kualifikasi, dan pelaporan.' },
    { title: 'Best Practice Procurement 2026', desc: 'Best Practice · v2026 · Menjadi pembanding kontrol proses procurement modern.' }
  ] },
  { title: 'SOP Anti Fraud', sub: 'BU Kepatuhan · 2 sumber aktif', sources: [
    { title: 'Audit Finding Procurement Q2', desc: 'Audit Finding · Q2 2026 · Dipakai untuk validasi area kontrol yang lemah.' }
  ] }
];

export default function LinksTab() {
  const [selected, setSelected] = useState(0);
  const item = ITEMS[selected];

  return <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
    <aside style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, fontSize: 13, fontWeight: 700 }}>Pilih SOP</div>
      {ITEMS.map((entry, index) => (
        <button key={entry.title} onClick={() => setSelected(index)} style={{
          display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', borderBottom: `1px solid ${BORDER}`,
          background: index === selected ? 'rgba(153,27,27,.06)' : 'transparent', cursor: 'pointer'
        }}>
          <b style={{ fontSize: 12.5, color: index === selected ? PRIMARY : FG }}>{entry.title}</b>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{entry.sub}</div>
        </button>
      ))}
    </aside>

    <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <div><h3 style={{ fontSize: 15, fontWeight: 700 }}>{item.title}</h3><p style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Sumber aktif yang menjadi pembanding resmi untuk refinement SOP ini.</p></div>
        <button style={{ padding: '0 14px', height: 32, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Hubungkan Sumber</button>
      </div>
      {item.sources.map((source) => (
        <div key={source.title} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${BORDER}` }}>
          <div><h4 style={{ fontSize: 13, fontWeight: 600 }}>{source.title}</h4><p style={{ fontSize: 11.5, color: MUTED, marginTop: 3 }}>{source.desc}</p></div>
          <Badge tone="green">AKTIF</Badge>
        </div>
      ))}
    </section>
  </div>;
}
