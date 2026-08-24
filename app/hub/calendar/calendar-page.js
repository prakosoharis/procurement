'use client';
import { useEffect, useMemo, useState } from 'react';
import Badge from '../_shared/badge';
import HubHeader from '../_shared/hub-header';
import Modal from '../_shared/modal';
import { BG, BORDER, CARD, FG, MUTED, PRIMARY } from '../_shared/tokens';

// Faithful React port of the static hub's Calendar page. The static markup
// was only a loading fallback -- setupAuditCalendarPage() replaced it with
// this same data-driven content at runtime, fetching GET /api/audit-events.

const STATUS_LABEL = { PLANNED: 'Direncanakan', SCHEDULED: 'Terjadwal', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan' };
const STATUS_TONE = { SCHEDULED: 'blue', COMPLETED: 'green', CANCELLED: 'red', PLANNED: 'amber' };
const FORMAT_LABEL = { ONSITE: 'On-site', REMOTE: 'Remote', HYBRID: 'Hybrid' };
const PARTICIPATION_LABEL = { INVITED: 'Menunggu respons', CONFIRMED: 'Hadir / dikonfirmasi', ATTENDED: 'Telah hadir', DECLINED: 'Tidak dapat hadir' };

const fmtDate = (value) => new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Permintaan gagal.');
  return payload;
}

function SummaryCard({ label, value, sub, color }) {
  return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16 }}>
    <div style={{ fontSize: 11, color: MUTED }}>{label}</div>
    <div style={{ fontSize: 25, fontWeight: 800, color: color || FG, marginTop: 4 }}>{value}</div>
    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{sub}</div>
  </div>;
}

function EventDetail({ event, viewerId, canRespond, onRespond, responding }) {
  const scope = event.audience === 'ALL_BUSINESS_UNITS' ? 'Event umum · seluruh Business Unit' : `${event.businessUnit?.name || 'Audit privat'} · PIC terpilih`;
  const myParticipation = (event.participants || []).find((p) => p.userId === viewerId);
  return <div>
    <p style={{ fontSize: 12, color: MUTED }}>{scope} · {STATUS_LABEL[event.status] || event.status}</p>
    <div style={{ background: BG, borderRadius: 9, padding: 14, marginTop: 16, fontSize: 12, lineHeight: 1.55 }}>
      <b>Agenda</b><br />{event.agenda}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14, fontSize: 12 }}>
      <div><span style={{ color: MUTED }}>Jadwal</span><br /><b>{fmtDate(event.startAt)}{event.endAt ? ` – ${fmtDate(event.endAt)}` : ''}</b></div>
      <div><span style={{ color: MUTED }}>Format / lokasi</span><br /><b>{FORMAT_LABEL[event.format] || event.format}{event.location ? ` · ${event.location}` : ''}</b></div>
    </div>
    <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700 }}>PIC yang dilibatkan</div>
    <div style={{ marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {event.audience === 'ALL_BUSINESS_UNITS'
        ? <Badge>Seluruh Business Unit</Badge>
        : (event.participants || []).map((p) => <Badge key={p.userId}>{p.user.name}</Badge>)}
    </div>
    {canRespond && <div style={{ marginTop: 18, padding: 13, border: `1px solid ${BORDER}`, borderRadius: 10, background: '#fafafa' }}>
      <div style={{ fontSize: 12, fontWeight: 700 }}>Konfirmasi partisipasi</div>
      <div style={{ fontSize: 11, color: MUTED, margin: '4px 0 10px' }}>Status: {PARTICIPATION_LABEL[myParticipation?.responseStatus || 'INVITED']}</div>
      <button disabled={responding} onClick={() => onRespond('CONFIRMED')} style={{ padding: '0 14px', height: 32, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, marginRight: 8, cursor: 'pointer' }}>Saya hadir</button>
      <button disabled={responding} onClick={() => onRespond('DECLINED')} style={{ padding: '0 14px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Tidak dapat hadir</button>
    </div>}
  </div>;
}

function CreateEventForm({ businessUnits, pics, onCreate, busy }) {
  const [audience, setAudience] = useState('SELECTED_PICS');
  const [participantIds, setParticipantIds] = useState([]);
  const isGeneral = audience === 'ALL_BUSINESS_UNITS';

  function toggle(id) {
    setParticipantIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function submit(event) {
    event.preventDefault();
    const form = event.target;
    if (!isGeneral && !participantIds.length) { alert('Pilih minimal satu PIC yang dilibatkan.'); return; }
    onCreate({
      title: form.title.value.trim(),
      audience,
      businessUnitId: form.businessUnitId.value || null,
      agenda: form.agenda.value.trim(),
      format: form.format.value,
      location: form.location.value.trim(),
      startAt: form.startAt.value,
      endAt: form.endAt.value || null,
      participantIds: isGeneral ? [] : participantIds
    });
  }

  const fieldStyle = { fontSize: 13, padding: '0 12px', height: 36, borderRadius: 8, border: `1px solid ${BORDER}`, width: '100%' };
  return <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <p style={{ fontSize: 12, color: MUTED }}>Audit hanya terlihat oleh PIC yang dipilih. Event umum seperti workshop akan terlihat oleh seluruh Business Unit.</p>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Judul event</label><input name="title" required placeholder="Contoh: Audit Kepatuhan Procurement Q3" style={fieldStyle} /></div>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Jenis akses</label>
      <select name="audience" value={audience} onChange={(e) => setAudience(e.target.value)} style={fieldStyle}>
        <option value="SELECTED_PICS">Audit privat — hanya PIC terpilih</option>
        <option value="ALL_BUSINESS_UNITS">Event umum — seluruh Business Unit</option>
      </select>
    </div>
    {!isGeneral && <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Business Unit yang diaudit <span style={{ color: MUTED, fontWeight: 400 }}>(opsional)</span></label>
      <select name="businessUnitId" style={fieldStyle}>
        <option value="">Tidak spesifik ke satu BU</option>
        {businessUnits.map((bu) => <option key={bu.id} value={bu.id}>{bu.name} · {bu.groupName}</option>)}
      </select>
    </div>}
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Agenda / ruang lingkup</label><textarea name="agenda" required rows={3} placeholder="Contoh: Review kepatuhan SOP, sampling tender, dan diskusi tindak lanjut." style={{ ...fieldStyle, height: 'auto', padding: 8 }} /></div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Format</label>
        <select name="format" defaultValue="ONSITE" style={fieldStyle}>
          <option value="ONSITE">On-site</option><option value="REMOTE">Remote</option><option value="HYBRID">Hybrid</option>
        </select>
      </div>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Lokasi / tautan meeting</label><input name="location" placeholder="Kantor BU / tautan Teams" style={fieldStyle} /></div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Mulai</label><input name="startAt" type="datetime-local" required style={fieldStyle} /></div>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Selesai</label><input name="endAt" type="datetime-local" style={fieldStyle} /></div>
    </div>
    {!isGeneral && <div>
      <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>PIC yang dilibatkan</label>
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, maxHeight: 150, overflow: 'auto', padding: 8, background: BG }}>
        {pics.length ? pics.map((pic) => (
          <label key={pic.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 5px', cursor: 'pointer', fontSize: 12 }}>
            <input type="checkbox" checked={participantIds.includes(pic.id)} onChange={() => toggle(pic.id)} style={{ width: 14, height: 14, padding: 0, margin: 0, border: '1px solid #9ca3af', borderRadius: 4, background: '#fff', flexShrink: 0 }} />
            <span><b>{pic.name}</b><span style={{ color: MUTED }}> · {pic.businessUnit?.name || '—'} · {pic.jobTitle || 'PIC'}</span></span>
          </label>
        )) : <div style={{ fontSize: 12, color: MUTED, padding: 6 }}>Belum ada PIC di Directory.</div>}
      </div>
      <small style={{ color: MUTED, display: 'block', marginTop: 5 }}>Pilih satu atau lebih PIC dari Directory, termasuk PIC dari BU berbeda.</small>
    </div>}
    <button type="submit" disabled={busy} style={{ alignSelf: 'flex-start', padding: '0 16px', height: 36, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>
      {busy ? 'Menyimpan…' : 'Simpan event'}
    </button>
  </form>;
}

export default function CalendarPage({ role }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [pics, setPics] = useState([]);
  const [detailEventId, setDetailEventId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [responding, setResponding] = useState(false);

  async function load() {
    try {
      const payload = await fetch('/api/audit-events').then(readJson);
      setData(payload);
      if (payload.viewer?.canManage) {
        fetch('/api/business-units').then((r) => r.json()).then(setBusinessUnits).catch(() => {});
        fetch('/api/pics').then((r) => r.json()).then(setPics).catch(() => {});
      }
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  const events = data?.events || [];
  const viewer = data?.viewer;
  const alerts = data?.alerts || [];

  const stats = useMemo(() => {
    const now = new Date();
    const upcoming = events.filter((e) => e.status !== 'CANCELLED' && new Date(e.startAt) >= now).length;
    const scheduled = events.filter((e) => e.status === 'SCHEDULED').length;
    const invited = events.filter((e) => (e.participants || []).some((p) => p.userId === viewer?.id)).length;
    return { upcoming, scheduled, invited };
  }, [events, viewer]);

  const detailEvent = events.find((e) => e.id === detailEventId) || null;

  async function createEvent(payload) {
    setCreating(true);
    try {
      await fetch('/api/audit-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(readJson);
      setCreateOpen(false);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function respond(status) {
    setResponding(true);
    try {
      await fetch(`/api/audit-events/${detailEventId}/participation`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ responseStatus: status }) }).then(readJson);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setResponding(false);
    }
  }

  return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader active="calendar" />
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700 }}>Audit Calendar</h2><p style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>Jadwal audit, agenda, dan PIC yang terlibat per Business Unit.</p></div>
        {viewer?.canManage && <button onClick={() => setCreateOpen(true)} style={{ padding: '0 14px', height: 32, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Jadwalkan Audit</button>}
      </div>

      {error && <div style={{ padding: 24, textAlign: 'center', color: MUTED }}>Calendar belum dapat dimuat. Silakan refresh halaman.</div>}

      {!error && <>
        {alerts.length > 0 && <div style={{ background: '#fff7ed', border: `1px solid #fed7aa`, borderLeft: `4px solid ${PRIMARY}`, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#9a3412' }}>🔔 Event Calendar untuk Anda</div>
          <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>{alerts.map((e) => <div key={e.id}><b>{e.title}</b> · {fmtDate(e.startAt)}</div>)}</div>
        </div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
          <SummaryCard label="Agenda Mendatang" value={stats.upcoming} sub="Audit aktif" />
          <SummaryCard label="Terjadwal" value={stats.scheduled} sub="Menunggu pelaksanaan" color={PRIMARY} />
          <SummaryCard label="Anda Dilibatkan" value={stats.invited} sub="Sebagai PIC audit" color="#15803d" />
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontSize: 14, fontWeight: 700 }}>Agenda audit mendatang</div><div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>Klik agenda untuk melihat PIC dan detail kegiatan.</div></div>
            <Badge>{data ? `${events.length} agenda` : 'Memuat...'}</Badge>
          </div>
          <div style={{ padding: '6px 18px' }}>
            {!data && <div style={{ padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>Memuat agenda…</div>}
            {data && !events.length && <div style={{ padding: 34, textAlign: 'center', color: MUTED }}>Belum ada event yang dijadwalkan.</div>}
            {events.map((event) => {
              const people = (event.participants || []).map((p) => p.user.name).join(', ') || 'Seluruh Business Unit';
              const scope = event.audience === 'ALL_BUSINESS_UNITS' ? 'Event umum' : (event.businessUnit?.name || 'Audit privat');
              return <button key={event.id} onClick={() => setDetailEventId(event.id)} style={{ width: '100%', textAlign: 'left', border: 0, borderBottom: `1px solid ${BORDER}`, background: 'transparent', padding: '14px 2px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: '#fbe7e7', color: PRIMARY, display: 'grid', placeItems: 'center', fontSize: 19, flexShrink: 0 }}>▣</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 13 }}>{event.title}</strong>
                      <Badge tone={STATUS_TONE[event.status] || 'muted'}>{STATUS_LABEL[event.status] || event.status}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 5 }}>{scope} · {FORMAT_LABEL[event.format] || event.format} · {fmtDate(event.startAt)}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>👥 {people}</div>
                  </div>
                  <span style={{ color: MUTED, fontSize: 18 }}>›</span>
                </div>
              </button>;
            })}
          </div>
        </div>
      </>}
    </div>

    <Modal open={Boolean(detailEvent)} onClose={() => setDetailEventId(null)} title={detailEvent?.title} width={560}>
      {detailEvent && <EventDetail event={detailEvent} viewerId={viewer?.id} canRespond={viewer?.role === 'BUSINESS_UNIT_PIC' && detailEvent.status !== 'CANCELLED'} onRespond={respond} responding={responding} />}
    </Modal>

    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Buat Event Calendar" width={680}>
      <CreateEventForm businessUnits={businessUnits} pics={pics} onCreate={createEvent} busy={creating} />
    </Modal>
  </div>;
}
