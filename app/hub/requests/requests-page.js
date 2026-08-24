'use client';
import { useEffect, useMemo, useState } from 'react';
import HubHeader from '../_shared/hub-header';
import { BG, BORDER, CARD, FG, MUTED, PRIMARY } from '../_shared/tokens';
import { ChangeRequestModal, ReviewRequestModal, CHANGE_LABEL } from './request-modals';

// Faithful React port of the static hub's Requests page. The "SOP Change
// Requests" section (loadChangeRequests() / setupChangeRequestPage()) is
// real, backed by /api/requests + /api/repository-overview. "Tiket
// Perbaikan SOP" and "Auto-Draft Laporan Hasil Audit (LHA)" below it were
// always 100% hardcoded demo content in the static asset -- their buttons
// only ever called showToast(), with no fetch anywhere -- so they are
// ported as static visuals rather than wired up, matching how the
// Repository page's Sources/Links tabs were treated.

const STATUS_LABEL = { SUBMITTED: 'Submitted', IN_REVIEW: 'In Review', REVISION_REQUIRED: 'Menunggu Respons BU', APPROVED: 'Closed — Approved', REJECTED: 'Closed — Rejected' };
const STATUS_TONE = {
  APPROVED: { background: '#dcfce7', color: '#15803d' }, REJECTED: { background: '#fee2e2', color: '#b91c1c' },
  REVISION_REQUIRED: { background: '#fef3c7', color: '#b45309' }, IN_REVIEW: { background: '#dbeafe', color: '#1d4ed8' },
  SUBMITTED: { background: '#eff1f4', color: MUTED }
};
const PRIORITY_TONE = {
  CRITICAL: { background: '#fee2e2', color: '#b91c1c' }, HIGH: { background: '#fee2e2', color: '#b91c1c' },
  MEDIUM: { background: '#fef3c7', color: '#b45309' }, LOW: { background: '#dcfce7', color: '#15803d' }
};

const TICKETS = [
  { id: 'TKT-001', desc: 'Revisi klausul tender terbuka di SOP Pengadaan', bu: 'BU Logistik A', pic: 'Budi S.', priority: 'High', status: 'In Progress', due: '15 Jul 2026' },
  { id: 'TKT-002', desc: 'Tambahkan proses evaluasi kualifikasi teknis vendor', bu: 'BU Logistik A', pic: 'Rina K.', priority: 'Medium', status: 'To Do', due: '20 Jul 2026' },
  { id: 'TKT-003', desc: 'Ubah frekuensi pelaporan dari semester ke triwulan', bu: 'BU Logistik A', pic: 'Dian P.', priority: 'Medium', status: 'To Do', due: '25 Jul 2026' },
  { id: 'TKT-004', desc: 'Update SOP due diligence vendor pihak ketiga', bu: 'BU Distribusi B', pic: 'Agus M.', priority: 'High', status: 'In Progress', due: '10 Jul 2026' },
  { id: 'TKT-005', desc: 'Penyesuaian batas otorisasi pengadaan', bu: 'BU Procurement D', pic: 'Sri W.', priority: 'Low', status: 'Resolved', due: '01 Jul 2026' },
  { id: 'TKT-006', desc: 'Standardisasi formulir pengadaan elektronik', bu: 'BU Keuangan C', pic: 'Hadi L.', priority: 'Low', status: 'Resolved', due: '28 Jun 2026' }
];
const TICKET_PRIORITY_TONE = { High: PRIORITY_TONE.HIGH, Medium: PRIORITY_TONE.MEDIUM, Low: PRIORITY_TONE.LOW };
const TICKET_STATUS_TONE = { 'In Progress': { background: '#dbeafe', color: '#1d4ed8' }, 'To Do': { background: '#eff1f4', color: MUTED }, Resolved: { background: '#dcfce7', color: '#15803d' } };

const LHA_DRAFT = `LAPORAN HASIL AUDIT (LHA)
Nomor: LHA/COMP/2026/007
Tanggal: 30 Juni 2026

RINGKASAN EKSEKUTIF
Audit kepatuhan terhadap SOP Pengadaan Barang & Jasa pada BU Logistik A telah dilaksanakan pada periode 23–30 Juni 2026.

TEMUAN UTAMA

1. [RISIKO TINGGI] Proses Tender Terbuka Tidak Diwajibkan
   Referensi SOP: BAB 2, Pasal 2.3
   Klausul Dilanggar: Pasal 15 POJK 12/2026

2. [RISIKO SEDANG] Evaluasi Kualifikasi Vendor Tidak Memadai
   Referensi SOP: BAB 3, Pasal 3.2
   Klausul Dilanggar: Pasal 18 POJK 12/2026

3. [RISIKO SEDANG] Frekuensi Pelaporan Tidak Sesuai
   Referensi SOP: BAB 4, Pasal 4.2
   Klausul Dilanggar: Pasal 25 POJK 12/2026

KESIMPULAN
Skor Kepatuhan BU Logistik A: 78% (Kategori: Sebagian Patuh)`;

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Permintaan gagal.');
  return payload;
}

function Badge({ tone, children }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, ...tone }}>{children}</span>;
}

export default function RequestsPage({ role, viewerId }) {
  const [requests, setRequests] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [approvedSops, setApprovedSops] = useState([]);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewItemId, setReviewItemId] = useState(null);

  async function load() {
    try {
      const [requestPayload, repository] = await Promise.all([
        fetch('/api/requests').then(readJson),
        fetch('/api/repository-overview').then(readJson)
      ]);
      setRequests(requestPayload.requests || []);
      setViewer(requestPayload.viewer || null);
      setNotifications(requestPayload.unreadNotifications || []);
      setApprovedSops((repository.documents || []).filter((d) => d.status === 'APPROVED'));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!requests) return [];
    const keyword = search.trim().toLowerCase();
    return requests.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!keyword) return true;
      return `${item.title} ${item.clauseReference} ${item.sopDocument?.title || ''} ${item.requester?.name || ''}`.toLowerCase().includes(keyword);
    });
  }, [requests, search, statusFilter]);

  const canManage = ['SUPER_USER', 'CORPORATE_GOVERNANCE'].includes(role);
  const reviewItem = reviewItemId ? requests?.find((r) => r.id === reviewItemId) : null;

  function openCreate() {
    if (!approvedSops.length) { alert('Belum ada SOP Approved yang dapat diajukan revisi'); return; }
    setCreateOpen(true);
  }

  async function openNotification(notification) {
    await fetch(`/api/requests/notifications/${notification.id}/read`, { method: 'POST' }).catch(() => null);
    await load();
    setReviewItemId(notification.message.request.id);
  }

  if (error) return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader active="requests" role={role} />
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28, textAlign: 'center', color: '#b91c1c' }}>Data request belum dapat dimuat. Silakan refresh halaman.</div>
    </div>
  </div>;

  const submitted = (requests || []).filter((r) => r.status === 'SUBMITTED').length;
  const inReview = (requests || []).filter((r) => r.status === 'IN_REVIEW').length;
  const revision = (requests || []).filter((r) => r.status === 'REVISION_REQUIRED').length;

  return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader active="requests" role={role} />
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div><h2 style={{ fontSize: 20, fontWeight: 700 }}>SOP Change Requests</h2><p style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>Ajukan perubahan pasal SOP yang telah Approved kepada Corporate Procurement.</p></div>

      <div style={{ borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ position: 'relative', overflow: 'hidden', padding: 26, background: 'linear-gradient(120deg,#67121a,#991b1b 62%,#bc3131)', color: '#fff' }}>
          <div style={{ position: 'absolute', width: 280, height: 280, border: '48px solid rgba(255,255,255,.07)', borderRadius: '50%', right: -86, top: -155 }} />
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 560 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.13em', color: 'rgba(255,255,255,.72)' }}>SOP CHANGE CONTROL</div>
              <h3 style={{ fontSize: 22, fontWeight: 700, margin: '10px 0 7px' }}>Setiap perubahan SOP, jelas jejak keputusannya.</h3>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.76)', lineHeight: 1.6 }}>Pilih SOP yang sudah Approved, identifikasi pasal terdampak, dan ajukan usulan perubahan dengan konteks bisnis yang lengkap.</p>
            </div>
            <button onClick={openCreate} style={{ padding: '0 18px', height: 38, borderRadius: 8, border: 'none', background: '#fff', color: PRIMARY, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 6px 18px rgba(0,0,0,.15)' }}>+ Ajukan Perubahan SOP</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', border: '1px solid rgba(153,27,27,.14)', borderTop: 0, background: CARD, color: FG }}>
          {[['1', 'BU mengajukan'], ['2', 'Corporate review'], ['3', 'SOP direvisi']].map(([no, label], i, arr) => (
            <div key={no} style={{ display: 'flex', alignItems: 'center', flex: i < arr.length - 1 ? '1 1 auto' : '0 0 auto' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 11, fontWeight: 600 }}>
                <b style={{ width: 23, height: 23, borderRadius: '50%', background: '#fbe7e7', color: PRIMARY, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{no}</b>{label}
              </span>
              {i < arr.length - 1 && <span style={{ height: 1, background: BORDER, width: 34, margin: '0 10px' }} />}
            </div>
          ))}
        </div>
      </div>

      {canManage && notifications.length > 0 && <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>🔔</span>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{notifications.length} respons baru dari Business Unit</div>
          <Badge tone={{ background: '#dbeafe', color: '#1d4ed8' }}>Perlu ditinjau</Badge>
        </div>
        {notifications.slice(0, 3).map((n) => (
          <button key={n.id} onClick={() => openNotification(n)} style={{ display: 'block', width: '100%', border: 'none', borderTop: '1px solid #bfdbfe', background: 'transparent', padding: '9px 0', textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{n.message.request.title}</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}><b>{n.message.sender.name}:</b> {n.message.body}</div>
          </button>
        ))}
      </div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr repeat(3,1fr)', gap: 12 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}><small style={{ fontSize: 10, color: MUTED }}>ALUR PERUBAHAN</small><strong style={{ display: 'block', fontSize: 14, marginTop: 7 }}>BU → Corporate Procurement → Revisi SOP</strong><small style={{ fontSize: 10, color: MUTED, marginTop: 6, display: 'block' }}>Setiap keputusan tercatat pada request.</small></div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderTop: '3px solid #64748b', borderRadius: 12, padding: 16 }}><small style={{ fontSize: 10, color: MUTED }}>MENUNGGU REVIEW</small><strong style={{ display: 'block', fontSize: 22, marginTop: 7 }}>{submitted}</strong><small style={{ fontSize: 10, color: MUTED }}>Request baru</small></div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderTop: '3px solid #2563eb', borderRadius: 12, padding: 16 }}><small style={{ fontSize: 10, color: MUTED }}>SEDANG DITINJAU</small><strong style={{ display: 'block', fontSize: 22, marginTop: 7 }}>{inReview}</strong><small style={{ fontSize: 10, color: MUTED }}>Corporate Procurement</small></div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderTop: '3px solid #d97706', borderRadius: 12, padding: 16 }}><small style={{ fontSize: 10, color: MUTED }}>PERLU TINDAKAN BU</small><strong style={{ display: 'block', fontSize: 22, marginTop: 7 }}>{revision}</strong><small style={{ fontSize: 10, color: MUTED }}>Perlu revisi informasi</small></div>
      </div>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div><h3 style={{ fontSize: 15, fontWeight: 700 }}>Daftar Permintaan Perubahan</h3><p style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Pantau proses review dan keputusan Corporate Procurement.</p></div>
          <Badge tone={{ background: '#eff1f4', color: MUTED }}>{filtered.length} request</Badge>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari SOP, pasal, atau pemohon..." style={{ fontSize: 12.5, padding: '0 12px', height: 34, borderRadius: 8, border: `1px solid ${BORDER}`, minWidth: 220, flex: 1 }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ fontSize: 12.5, padding: '0 10px', height: 34, borderRadius: 8, border: `1px solid ${BORDER}`, width: 175 }}>
            <option value="">Semua Status</option>
            <option value="SUBMITTED">Submitted</option><option value="IN_REVIEW">In Review</option><option value="REVISION_REQUIRED">Perlu Revisi</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr>{['Request', 'SOP & Pasal', 'Jenis Perubahan', 'Pemohon', 'Prioritas', 'Status', ''].map((h) => <th key={h} style={{ textAlign: 'left', padding: '9px 10px', borderBottom: `1px solid ${BORDER}`, color: MUTED, fontWeight: 600, fontSize: 11 }}>{h}</th>)}</tr></thead>
            <tbody>
              {requests === null && <tr><td colSpan={7} style={{ textAlign: 'center', color: MUTED, padding: 24 }}>Memuat data request…</td></tr>}
              {requests !== null && !filtered.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: MUTED, padding: 24 }}>Belum ada permintaan yang sesuai.</td></tr>}
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}` }}><div style={{ fontWeight: 600 }}>{item.title}</div><div style={{ fontFamily: 'monospace', fontSize: 10, color: MUTED, marginTop: 3 }}>{item.id.slice(-8).toUpperCase()}</div></td>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}` }}><div style={{ fontWeight: 500 }}>{item.sopDocument?.title}</div><div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{item.sopDocument?.businessUnit?.name} · {item.clauseReference}</div></td>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}` }}>{CHANGE_LABEL[item.changeType] || item.changeType}</td>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}` }}>{item.requester?.name}</td>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}` }}><Badge tone={PRIORITY_TONE[item.priority] || PRIORITY_TONE.MEDIUM}>{item.priority}</Badge></td>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}` }}><Badge tone={STATUS_TONE[item.status] || STATUS_TONE.SUBMITTED}>{STATUS_LABEL[item.status] || item.status}</Badge></td>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}` }}><button onClick={() => setReviewItemId(item.id)} style={{ padding: '0 10px', height: 26, borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}>Detail / Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Tiket Perbaikan SOP</h3>
          <button style={{ padding: '0 14px', height: 32, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>+ Buat Tiket</button>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <input placeholder="Cari tiket..." style={{ fontSize: 12, padding: '0 12px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, maxWidth: 280, flex: 1 }} />
          <select style={{ fontSize: 12, padding: '0 10px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, width: 140 }}><option>Semua Status</option><option>To Do</option><option>In Progress</option><option>Resolved</option></select>
        </div>
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr>{['ID', 'Deskripsi', 'Bisnis Unit', 'PIC', 'Prioritas', 'Status', 'Due Date'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '9px 10px', borderBottom: `1px solid ${BORDER}`, color: MUTED, fontWeight: 600, fontSize: 11 }}>{h}</th>)}</tr></thead>
            <tbody>
              {TICKETS.map((t) => (
                <tr key={t.id}>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}`, fontFamily: 'monospace', color: MUTED }}>{t.id}</td>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}`, fontWeight: 500, maxWidth: 280 }}>{t.desc}</td>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}`, color: MUTED }}>{t.bu}</td>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}` }}>{t.pic}</td>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}` }}><Badge tone={TICKET_PRIORITY_TONE[t.priority]}>{t.priority}</Badge></td>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}` }}><Badge tone={TICKET_STATUS_TONE[t.status]}>{t.status}</Badge></td>
                  <td style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}`, color: MUTED }}>{t.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>✨</span><h3 style={{ fontSize: 14, fontWeight: 600 }}>Auto-Draft Laporan Hasil Audit (LHA)</h3><Badge tone={{ background: '#fef3c7', color: '#b45309' }}>AI Generated</Badge></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ padding: '0 12px', height: 30, borderRadius: 7, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>🔄 Regenerate</button>
            <button style={{ padding: '0 12px', height: 30, borderRadius: 7, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>📋 Salin</button>
            <button style={{ padding: '0 12px', height: 30, borderRadius: 7, border: 'none', background: PRIMARY, color: '#fff', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>📥 Unduh PDF</button>
          </div>
        </div>
        <textarea readOnly defaultValue={LHA_DRAFT} style={{ width: '100%', minHeight: 400, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, padding: 16, borderRadius: 8, border: `1px solid ${BORDER}` }} />
      </div>
    </div>

    <ChangeRequestModal open={createOpen} onClose={() => setCreateOpen(false)} approvedSops={approvedSops} onCreated={(duplicate) => { load(); }} />
    <ReviewRequestModal open={!!reviewItemId} onClose={() => setReviewItemId(null)} item={reviewItem} viewerId={viewer?.id || viewerId} canManage={canManage}
      onReplied={async () => { await load(); }}
      onReviewed={async () => { setReviewItemId(null); await load(); }} />
  </div>;
}
