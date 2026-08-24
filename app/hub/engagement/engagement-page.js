'use client';
import { useEffect, useState } from 'react';
import Badge from '../_shared/badge';
import EngagementComponent, { engagementTone } from '../_shared/engagement-component';
import HubHeader from '../_shared/hub-header';
import { BG, BORDER, CARD, FG, MUTED } from '../_shared/tokens';

// Faithful React port of the static hub's Engagement Insights page
// (loadEngagementInsights()): a per-Business-Unit drill-down into the same
// four indicators Home's BU Engagement Index card summarizes.

const STATUS_LABEL = {
  APPROVED: 'Disetujui', PUBLISHED: 'Dipublikasikan', DRAFT: 'Draft', IN_REVIEW: 'Dalam review', ARCHIVED: 'Diarsipkan',
  MISSING: 'Belum ada', SUBMITTED: 'Diajukan', REVISION_REQUIRED: 'Perlu respons BU', REJECTED: 'Ditolak',
  CONFIRMED: 'Dikonfirmasi hadir', ATTENDED: 'Telah hadir', DECLINED: 'Tidak hadir', INVITED: 'Menunggu konfirmasi'
};
const statusColor = (status) => (['APPROVED', 'PUBLISHED', 'ATTENDED', 'CONFIRMED'].includes(status) ? '#15803d' : ['MISSING', 'REVISION_REQUIRED', 'REJECTED', 'DECLINED'].includes(status) ? '#b91c1c' : '#b45309');
const fmtDate = (value) => value ? new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Belum ada aktivitas';

function Table({ headers, rows, empty }) {
  return <div style={{ overflow: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead><tr>{headers.map((h) => <th key={h} style={{ textAlign: 'left', padding: '8px 6px', borderBottom: `1px solid ${BORDER}`, color: MUTED, fontWeight: 600 }}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.length ? rows : <tr><td colSpan={headers.length} style={{ textAlign: 'center', color: MUTED, padding: 18 }}>{empty}</td></tr>}
      </tbody>
    </table>
  </div>;
}

function Card({ children, style }) {
  return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, ...style }}>{children}</div>;
}

export default function EngagementInsightsPage() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const [businessUnitId, setBusinessUnitId] = useState('');

  async function load(id) {
    try {
      const url = '/api/engagement' + (id ? `?businessUnitId=${encodeURIComponent(id)}` : '');
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat detail');
      if (!data.detail && data.units?.length) { load(data.units[0].id); return; }
      setPayload(data);
      if (data.detail) setBusinessUnitId(data.units.find((u) => u.id === data.detail.businessUnit.id)?.id || data.units[0]?.id || '');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  if (error) return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader active="engagement" />
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24 }}>
      <Card style={{ padding: 28, textAlign: 'center', color: '#b91c1c' }}>Engagement Insights belum dapat dimuat. Silakan refresh halaman.</Card>
    </div>
  </div>;

  if (!payload?.detail) return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader active="engagement" />
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24 }}>
      <Card style={{ padding: 28, textAlign: 'center', color: MUTED }}>Memuat detail engagement...</Card>
    </div>
  </div>;

  const { detail, units, viewer, period } = payload;
  const unit = units.find((u) => u.id === detail.businessUnit.id) || units[0];
  const c = unit.components;
  const showSelector = viewer.role !== 'BUSINESS_UNIT_PIC';

  return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader active="engagement" />
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700 }}>Engagement Insights</h2><p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Rincian indikator engagement selama {period.days} hari terakhir.</p></div>
        {showSelector && <select value={businessUnitId} onChange={(e) => load(e.target.value)} style={{ minWidth: 240, fontSize: 13, height: 36, padding: '0 12px', borderRadius: 8, border: `1px solid ${BORDER}` }}>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.industry || '—'}</option>)}
        </select>}
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: MUTED }}>BUSINESS UNIT</div>
            <h3 style={{ fontSize: 18, marginTop: 3 }}>{detail.businessUnit.name}</h3>
            <div style={{ fontSize: 12, color: MUTED }}>{detail.businessUnit.groupName} · {detail.businessUnit.industry}</div>
          </div>
          <Badge tone={unit.score >= 80 ? 'green' : unit.score >= 60 ? 'amber' : 'red'}>{unit.level.replace(/_/g, ' ')}</Badge>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(150px,1fr))', gap: 10, marginTop: 16 }}>
          <EngagementComponent label="Document Compliance" health={c.documents.health} description={`${c.documents.approved}/${c.documents.total} mandatory disetujui`} />
          <EngagementComponent label="Submission Responsiveness" health={c.submissions.health} description={`${c.submissions.overdueRevisions} revisi melewati SLA`} />
          <EngagementComponent label="Calendar Participation" health={c.calendar.health} description={`${c.calendar.confirmed + c.calendar.attended}/${c.calendar.invited} event dikonfirmasi`} />
          <EngagementComponent label="PIC Activity" health={c.activity.health} description={`${c.activity.activePics}/${c.activity.totalPics} PIC aktif`} />
        </div>
      </Card>

      <Card>
        <h3 style={{ fontSize: 15 }}>Document Compliance</h3>
        <p style={{ fontSize: 12, color: MUTED, margin: '4px 0 12px' }}>Status setiap dokumen mandatory.</p>
        <Table headers={['Jenis dokumen', 'Dokumen saat ini', 'Versi', 'Status']} empty="Tidak ada dokumen." rows={detail.documents.map((item) => (
          <tr key={item.code}>
            <td style={{ padding: '8px 6px', borderBottom: `1px solid ${BORDER}` }}><b>{item.code}</b> · {item.name}</td>
            <td style={{ padding: '8px 6px', borderBottom: `1px solid ${BORDER}` }}>{item.title || '—'}</td>
            <td style={{ padding: '8px 6px', borderBottom: `1px solid ${BORDER}` }}>{item.version || '—'}</td>
            <td style={{ padding: '8px 6px', borderBottom: `1px solid ${BORDER}` }}><b style={{ color: statusColor(item.status) }}>{STATUS_LABEL[item.status] || item.status}</b></td>
          </tr>
        ))} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <h3 style={{ fontSize: 15 }}>Submission</h3>
          <div style={{ marginTop: 12 }}>
            <Table headers={['Permintaan', 'Diajukan', 'Status']} empty="Tidak ada submission dalam periode ini." rows={detail.submissions.map((item, i) => (
              <tr key={i}>
                <td style={{ padding: '8px 6px', borderBottom: `1px solid ${BORDER}` }}><b>{item.title}</b><br /><span style={{ fontSize: 11, color: MUTED }}>{item.documentTitle || '—'}</span></td>
                <td style={{ padding: '8px 6px', borderBottom: `1px solid ${BORDER}` }}>{fmtDate(item.createdAt)}</td>
                <td style={{ padding: '8px 6px', borderBottom: `1px solid ${BORDER}` }}><b style={{ color: statusColor(item.status) }}>{STATUS_LABEL[item.status] || item.status}</b></td>
              </tr>
            ))} />
          </div>
        </Card>
        <Card>
          <h3 style={{ fontSize: 15 }}>Calendar Participation</h3>
          <div style={{ marginTop: 12 }}>
            <Table headers={['Event', 'Jadwal', 'Respons']} empty="Tidak ada event yang melibatkan PIC pada periode ini." rows={detail.calendar.map((item, i) => (
              <tr key={i}>
                <td style={{ padding: '8px 6px', borderBottom: `1px solid ${BORDER}` }}><b>{item.event.title}</b></td>
                <td style={{ padding: '8px 6px', borderBottom: `1px solid ${BORDER}` }}>{fmtDate(item.event.startAt)}</td>
                <td style={{ padding: '8px 6px', borderBottom: `1px solid ${BORDER}` }}><b style={{ color: statusColor(item.responseStatus) }}>{STATUS_LABEL[item.responseStatus] || item.responseStatus}</b></td>
              </tr>
            ))} />
          </div>
        </Card>
      </div>

      <Card>
        <h3 style={{ fontSize: 15 }}>PIC Activity</h3>
        <p style={{ fontSize: 12, color: MUTED, margin: '4px 0 12px' }}>Aktivitas login PIC dalam periode berjalan.</p>
        <Table headers={['PIC', 'Status', 'Login terakhir']} empty="Belum ada PIC untuk Business Unit ini." rows={detail.picActivity.map((item, i) => (
          <tr key={i}>
            <td style={{ padding: '8px 6px', borderBottom: `1px solid ${BORDER}` }}><b>{item.name}</b><br /><span style={{ fontSize: 11, color: MUTED }}>{item.email}</span></td>
            <td style={{ padding: '8px 6px', borderBottom: `1px solid ${BORDER}`, color: item.active ? '#15803d' : '#b45309' }}>{item.active ? 'Aktif' : 'Belum aktif'}</td>
            <td style={{ padding: '8px 6px', borderBottom: `1px solid ${BORDER}` }}>{fmtDate(item.lastLoginAt)}</td>
          </tr>
        ))} />
      </Card>
    </div>
  </div>;
}
