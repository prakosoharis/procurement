'use client';
import { useState } from 'react';
import Badge from '../_shared/badge';
import Modal from '../_shared/modal';
import { BORDER, CARD, FG, MUTED, PRIMARY } from '../_shared/tokens';

// Faithful visual port of the static hub's "Sumber Pembanding" tab. This
// content is 100% decorative in the approved asset: the table rows are
// literal hardcoded HTML (not fetched from anywhere), and every "Buka" /
// "Validasi" button and the "+ Tambah Sumber" ingestion modal's submit
// actions have no real handler -- they just close the modal with a toast.
// Ported as-is rather than wired up, matching every other page conversion's
// treatment of pre-existing fake demo content in this app.

const CARDS = [
  { tone: 'blue', label: 'Regulation', title: 'POJK No. 12/2026', desc: 'Sumber eksternal aktif untuk validasi ketentuan tender, evaluasi vendor, dan pelaporan berkala.' },
  { tone: 'blue', label: 'Best Practice', title: 'Best Practice Procurement 2026', desc: 'Katalog praktik pembanding internal untuk standardisasi proses sourcing dan vendor management.' },
  { tone: 'amber', label: 'Audit Finding', title: 'Audit Finding Procurement Q2', desc: 'Temuan audit yang bisa dipakai sebagai rujukan refinement SOP lintas Business Unit.' }
];

const ROWS = [
  { title: 'POJK No. 12/2026', sub: 'Pedoman Pengadaan Barang dan Jasa', origin: 'External Data', category: 'Regulation', owner: 'OJK', version: '2026.05', status: 'AKTIF', action: 'Buka' },
  { title: 'Best Practice Procurement 2026', sub: 'Control checklist', origin: 'Internal Data', category: 'Best Practice', owner: 'Corporate Procurement', version: 'v2026', status: 'AKTIF', action: 'Buka' },
  { title: 'Spending Analysis Q2 2026', sub: null, origin: 'Internal Data', category: 'Spending Analysis', owner: 'Procurement Analytics', version: 'Q2 2026', status: 'DRAFT', action: 'Validasi' }
];

export default function SourcesTab() {
  const [ingestOpen, setIngestOpen] = useState(false);
  const [mode, setMode] = useState('scrape');

  return <>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
      {CARDS.map((card) => (
        <div key={card.title} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18 }}>
          <Badge tone={card.tone}>{card.label}</Badge>
          <h4 style={{ fontSize: 14, fontWeight: 700, marginTop: 10, color: FG }}>{card.title}</h4>
          <p style={{ fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>{card.desc}</p>
          <button style={{ marginTop: 12, padding: '0 14px', height: 30, borderRadius: 7, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Buka</button>
        </div>
      ))}
    </div>

    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', marginTop: 16 }}>
      <div style={{ padding: '16px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div><h3 style={{ fontSize: 15, fontWeight: 700 }}>Katalog Sumber Pembanding</h3><p style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Sumber internal dan eksternal yang menjadi pembanding resmi aplikasi.</p></div>
        <button onClick={() => setIngestOpen(true)} style={{ padding: '0 14px', height: 32, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>+ Tambah Sumber</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr>{['Judul', 'Asal', 'Kategori', 'Pemilik', 'Versi', 'Status', 'Aksi'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, color: MUTED, fontWeight: 600 }}>{h}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.title}>
                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}><b>{row.title}</b>{row.sub && <><br /><span style={{ fontSize: 11, color: MUTED }}>{row.sub}</span></>}</td>
                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>{row.origin}</td>
                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>{row.category}</td>
                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>{row.owner}</td>
                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>{row.version}</td>
                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}><Badge tone={row.status === 'AKTIF' ? 'green' : 'amber'}>{row.status}</Badge></td>
                <td style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}><button style={{ padding: '0 12px', height: 28, borderRadius: 7, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>{row.action}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <Modal open={ingestOpen} onClose={() => setIngestOpen(false)} title="Tambah Sumber" subtitle="Ambil sumber pembanding dari tautan eksternal atau unggah file secara langsung.">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['scrape', 'Ambil dari tautan'], ['upload', 'Unggah file']].map(([key, label]) => (
          <button key={key} onClick={() => setMode(key)} style={{ flex: 1, padding: '0 12px', height: 34, borderRadius: 8, border: `1px solid ${BORDER}`, background: mode === key ? PRIMARY : CARD, color: mode === key ? '#fff' : FG, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
        ))}
      </div>
      {mode === 'scrape'
        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="https://..." style={{ fontSize: 13, padding: '0 12px', height: 36, borderRadius: 8, border: `1px solid ${BORDER}` }} />
            <button onClick={() => setIngestOpen(false)} style={{ alignSelf: 'flex-start', padding: '0 16px', height: 36, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>▶ Mulai</button>
          </div>
        : <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 10, padding: 28, textAlign: 'center', color: MUTED, fontSize: 12.5 }}>Seret file ke sini atau klik untuk memilih.</div>}
    </Modal>
  </>;
}
