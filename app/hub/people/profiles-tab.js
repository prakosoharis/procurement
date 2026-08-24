'use client';
import { useEffect, useRef, useState } from 'react';
import Modal from '../_shared/modal';
import { BORDER, CARD, FG, MUTED, PRIMARY } from '../_shared/tokens';
import { peopleRequest, fieldStyle, fmtDate } from './people-api';

// Faithful React port of the static hub's Profil Personel tab
// (renderPeopleProfileList / openPeopleProfile / openPeopleProfileForm).
// Sensitive fields (email, phone, photo, certification credential/evidence)
// are already nulled server-side for Business-Unit-scoped viewers, so the
// UI just renders whatever the API returns without its own masking logic.

let rowKeySeed = 0;
const nextRowKey = () => `row-${++rowKeySeed}`;

function experienceLabel(profile) {
  if (!profile.totalWorkExperience) return 'Tanggal mulai bekerja belum diisi.';
  const { years, months } = profile.totalWorkExperience;
  return `Total pengalaman kerja: ${years} tahun ${months} bulan`;
}

function QualificationRows({ kind, rows, setRows }) {
  const isEducation = kind === 'education';
  function update(key, field, value) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row));
  }
  function remove(key) {
    setRows((current) => current.filter((row) => row.key !== key));
  }
  function add() {
    setRows((current) => [...current, { key: nextRowKey() }]);
  }
  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600 }}>{isEducation ? 'Pendidikan' : 'Sertifikasi'}</label>
      <button type="button" onClick={add} style={{ fontSize: 11.5, fontWeight: 600, color: PRIMARY, background: 'transparent', border: 'none', cursor: 'pointer' }}>＋ Tambah {isEducation ? 'pendidikan' : 'sertifikasi'}</button>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((row) => (
        <div key={row.key} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {isEducation ? <>
            <input placeholder="Institusi" defaultValue={row.institution} onChange={(e) => update(row.key, 'institution', e.target.value)} style={fieldStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <input placeholder="Jenjang" defaultValue={row.degreeLevel} onChange={(e) => update(row.key, 'degreeLevel', e.target.value)} style={fieldStyle} />
              <input placeholder="Bidang studi" defaultValue={row.fieldOfStudy} onChange={(e) => update(row.key, 'fieldOfStudy', e.target.value)} style={fieldStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <input type="number" placeholder="Tahun mulai" defaultValue={row.startYear} onChange={(e) => update(row.key, 'startYear', e.target.value)} style={fieldStyle} />
              <input type="number" placeholder="Tahun lulus" defaultValue={row.graduationYear} onChange={(e) => update(row.key, 'graduationYear', e.target.value)} style={fieldStyle} />
            </div>
          </> : <>
            <input placeholder="Nama sertifikasi" defaultValue={row.name} onChange={(e) => update(row.key, 'name', e.target.value)} style={fieldStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <input placeholder="Penerbit" defaultValue={row.issuer} onChange={(e) => update(row.key, 'issuer', e.target.value)} style={fieldStyle} />
              <input placeholder="ID kredensial" defaultValue={row.credentialId} onChange={(e) => update(row.key, 'credentialId', e.target.value)} style={fieldStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <input type="date" placeholder="Tanggal terbit" defaultValue={row.issueDate} onChange={(e) => update(row.key, 'issueDate', e.target.value)} style={fieldStyle} />
              <input type="date" placeholder="Tanggal kedaluwarsa" defaultValue={row.expiryDate} onChange={(e) => update(row.key, 'expiryDate', e.target.value)} style={fieldStyle} />
            </div>
            <input placeholder="URL bukti (opsional)" defaultValue={row.evidenceUrl} onChange={(e) => update(row.key, 'evidenceUrl', e.target.value)} style={fieldStyle} />
          </>}
          <button type="button" onClick={() => remove(row.key)} style={{ alignSelf: 'flex-start', fontSize: 11, color: '#b91c1c', background: 'transparent', border: 'none', cursor: 'pointer' }}>Hapus</button>
        </div>
      ))}
      {!rows.length && <p style={{ fontSize: 11.5, color: MUTED }}>Belum ada {isEducation ? 'riwayat pendidikan' : 'sertifikasi'}.</p>}
    </div>
  </div>;
}

function toRowPayload(rows, kind) {
  const isEducation = kind === 'education';
  return rows.map((row) => isEducation
    ? { id: row.id, institution: row.institution || '', degreeLevel: row.degreeLevel || '', fieldOfStudy: row.fieldOfStudy || '', startYear: row.startYear ? Number(row.startYear) : null, graduationYear: row.graduationYear ? Number(row.graduationYear) : null }
    : { id: row.id, name: row.name || '', issuer: row.issuer || '', credentialId: row.credentialId || null, issueDate: row.issueDate || null, expiryDate: row.expiryDate || null, evidenceUrl: row.evidenceUrl || null });
}

function ProfileForm({ initial, onSubmit, busy }) {
  const [educations, setEducations] = useState(() => (initial?.educations || []).map((row) => ({ ...row, key: nextRowKey() })));
  const [certifications, setCertifications] = useState(() => (initial?.certifications || []).map((row) => ({ ...row, key: nextRowKey() })));

  function submit(event) {
    event.preventDefault();
    const form = event.target;
    onSubmit({
      fullName: form.fullName.value.trim(), employeeIdentifier: form.employeeIdentifier.value.trim() || null,
      email: form.email.value.trim() || null, phone: form.phone.value.trim() || null,
      firstWorkStartedAt: form.firstWorkStartedAt.value, photoUrl: form.photoUrl.value.trim() || null,
      educations: toRowPayload(educations, 'education'), certifications: toRowPayload(certifications, 'certification')
    });
  }

  return <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Nama lengkap</label><input name="fullName" required defaultValue={initial?.fullName || ''} style={fieldStyle} /></div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Nomor personel</label><input name="employeeIdentifier" defaultValue={initial?.employeeIdentifier || ''} style={fieldStyle} /></div>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Tanggal mulai bekerja pertama kali</label><input name="firstWorkStartedAt" type="date" required defaultValue={initial?.firstWorkStartedAt ? initial.firstWorkStartedAt.slice(0, 10) : ''} style={fieldStyle} /></div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Email</label><input name="email" type="email" defaultValue={initial?.email || ''} style={fieldStyle} /></div>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Telepon</label><input name="phone" defaultValue={initial?.phone || ''} style={fieldStyle} /></div>
    </div>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>URL foto <span style={{ color: MUTED, fontWeight: 400 }}>(opsional)</span></label><input name="photoUrl" defaultValue={initial?.photoUrl || ''} style={fieldStyle} /></div>
    <QualificationRows kind="education" rows={educations} setRows={setEducations} />
    <QualificationRows kind="certification" rows={certifications} setRows={setCertifications} />
    <button type="submit" disabled={busy} style={{ alignSelf: 'flex-start', padding: '0 16px', height: 36, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>{busy ? 'Menyimpan…' : 'Simpan Profil'}</button>
  </form>;
}

function ProfileDetail({ personId, capabilities, onEdit, onChanged }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProfile(null);
    setError(null);
    peopleRequest(`/api/people/profiles/${personId}`).then((data) => setProfile(data.profile)).catch((err) => setError(err.message));
  }, [personId]);

  async function archive() {
    if (!window.confirm(`Arsipkan profil "${profile.fullName}"?`)) return;
    setBusy(true);
    try {
      await peopleRequest(`/api/people/profiles/${personId}`, { method: 'PATCH', body: JSON.stringify({ operation: 'archive', expectedUpdatedAt: profile.updatedAt }) });
      onChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p style={{ fontSize: 13, color: '#b91c1c' }}>{error}</p>;
  if (!profile) return <p style={{ fontSize: 13, color: MUTED }}>Memuat profil…</p>;

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ fontSize: 12, color: MUTED }}>
      {profile.employeeIdentifier || 'Tanpa nomor personel'}{profile.email ? ` · ${profile.email}` : ''}{profile.phone ? ` · ${profile.phone}` : ''}
    </div>
    <div style={{ fontSize: 13, fontWeight: 600, color: FG }}>{experienceLabel(profile)}</div>

    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6 }}>PENDIDIKAN FORMAL</div>
      {profile.educations?.length ? profile.educations.map((row) => (
        <div key={row.id} style={{ fontSize: 12.5, padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
          <b>{row.institution}</b> — {row.degreeLevel}{row.fieldOfStudy ? `, ${row.fieldOfStudy}` : ''}
          <div style={{ color: MUTED, fontSize: 11 }}>{row.startYear || '—'}–{row.graduationYear || 'sekarang'}</div>
        </div>
      )) : <p style={{ fontSize: 12, color: MUTED }}>Belum ada riwayat pendidikan.</p>}
    </div>

    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6 }}>SERTIFIKASI</div>
      {profile.certifications?.length ? profile.certifications.map((row) => (
        <div key={row.id} style={{ fontSize: 12.5, padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
          <b>{row.name}</b> — {row.issuer}
          <div style={{ color: MUTED, fontSize: 11 }}>{fmtDate(row.issueDate)}{row.expiryDate ? ` – ${fmtDate(row.expiryDate)}` : ''}</div>
        </div>
      )) : <p style={{ fontSize: 12, color: MUTED }}>Belum ada sertifikasi.</p>}
    </div>

    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6 }}>RIWAYAT PENEMPATAN</div>
      {profile.assignments?.length ? profile.assignments.map((a) => (
        <div key={a.id} style={{ fontSize: 12.5, padding: '6px 0', borderBottom: `1px solid ${BORDER}` }}>
          <b>{a.position.title}</b> <span style={{ color: MUTED }}>· {a.position.scope?.name || '—'}</span>
          <div style={{ color: MUTED, fontSize: 11 }}>{fmtDate(a.startDate)} – {a.endDate ? fmtDate(a.endDate) : 'sekarang'}</div>
        </div>
      )) : <p style={{ fontSize: 12, color: MUTED }}>Belum ada riwayat penempatan.</p>}
    </div>

    {capabilities.canManagePeople && <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
      <button onClick={() => onEdit(profile)} style={{ padding: '0 12px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit profil</button>
      <button disabled={busy} onClick={archive} style={{ padding: '0 12px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: '#b91c1c', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Arsipkan</button>
    </div>}
  </div>;
}

export default function ProfilesTab({ capabilities }) {
  const [profiles, setProfiles] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [formMode, setFormMode] = useState(null);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);

  async function load(q) {
    try {
      const data = await peopleRequest(`/api/people/profiles?q=${encodeURIComponent(q)}`);
      setProfiles(data.profiles);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(''); }, []);

  function onSearchChange(value) {
    setQuery(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => load(value), 220);
  }

  async function saveProfile(body) {
    setSaving(true);
    try {
      if (formMode.mode === 'edit') {
        await peopleRequest(`/api/people/profiles/${formMode.profile.id}`, { method: 'PATCH', body: JSON.stringify({ operation: 'update', ...body, expectedUpdatedAt: formMode.profile.updatedAt }) });
      } else {
        await peopleRequest('/api/people/profiles', { method: 'POST', body: JSON.stringify(body) });
      }
      setFormMode(null);
      setDetailId(null);
      await load(query);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>Profil Personel</h3>
        <p style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>Profil bersifat reusable; penempatan jabatan dikelola terpisah.</p>
      </div>
      {capabilities.canManagePeople && <button onClick={() => setFormMode({ mode: 'create' })} style={{ padding: '0 14px', height: 34, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>＋ Tambah Personel</button>}
    </div>

    <input value={query} onChange={(event) => onSearchChange(event.target.value)} placeholder="Cari nama atau nomor personel" style={{ ...fieldStyle, maxWidth: 420, marginBottom: 14 }} />

    {error && <p style={{ fontSize: 13, color: '#b91c1c', textAlign: 'center', padding: 24 }}>Profil belum dapat dimuat. Silakan refresh halaman.</p>}
    {!error && profiles === null && <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', padding: 24 }}>Memuat profil…</p>}
    {!error && profiles?.length === 0 && <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', padding: 24 }}>Belum ada profil yang dapat ditampilkan.</p>}
    {profiles?.map((profile) => (
      <button key={profile.id} onClick={() => setDetailId(profile.id)} style={{ width: '100%', textAlign: 'left', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: 13, marginTop: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          <b style={{ display: 'block', fontSize: 13 }}>{profile.fullName}</b>
          <small style={{ display: 'block', color: MUTED, marginTop: 3 }}>{profile.employeeIdentifier || 'Tanpa nomor personel'}{profile.email ? ` · ${profile.email}` : ''}</small>
        </span>
        <b style={{ fontSize: 11, color: MUTED }}>Detail ›</b>
      </button>
    ))}

    <Modal open={!!detailId && !formMode} onClose={() => setDetailId(null)} title="Profil Personel" width={560}>
      {detailId && <ProfileDetail personId={detailId} capabilities={capabilities} onEdit={(profile) => setFormMode({ mode: 'edit', profile })} onChanged={() => { setDetailId(null); load(query); }} />}
    </Modal>

    <Modal open={!!formMode} onClose={() => setFormMode(null)} title={formMode?.mode === 'edit' ? 'Edit Profil' : 'Tambah Personel'} width={640}>
      {formMode && <ProfileForm initial={formMode.mode === 'edit' ? formMode.profile : null} busy={saving} onSubmit={saveProfile} />}
    </Modal>
  </div>;
}
