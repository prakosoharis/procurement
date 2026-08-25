'use client';
import { useEffect, useMemo, useState } from 'react';
import Modal from '../_shared/modal';
import { BORDER, CARD, FG, MUTED, PRIMARY } from '../_shared/tokens';
import { directSopUpload, documentFileUrl, fmtDate, readJson } from './repository-api';

const fieldStyle = { fontSize: 13, padding: '0 12px', height: 36, borderRadius: 8, border: `1px solid ${BORDER}`, width: '100%' };
const labelStyle = { fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' };

function nextVersion(version) {
  const match = /^v(\d+)\.(\d+)$/i.exec(version || 'v0.0');
  return match ? `v${match[1]}.${Number(match[2]) + 1}` : 'v1.0';
}

// Shared by both create and update: prepares a session, puts the file
// straight to Vercel Blob, waits for the Google Drive transfer, and surfaces
// each step as a submit-button label the way the original inline JS did.
function useUpload(onDone) {
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');

  async function run({ prepareUrl, file, metadata }) {
    setBusy(true);
    setStatusText('Menyiapkan upload...');
    try {
      const result = await directSopUpload({ prepareUrl, file, metadata, onStatus: setStatusText });
      onDone(result);
    } catch (error) {
      alert(error.message);
    } finally {
      setBusy(false);
      setStatusText('');
    }
  }

  return { run, busy, statusText };
}

export function CreateSopModal({ open, onClose, overview, pics, prefill, onCreated }) {
  const [groupId, setGroupId] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [businessUnitId, setBusinessUnitId] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const { run, busy, statusText } = useUpload((result) => {
    onCreated(result);
  });

  useEffect(() => {
    if (!open) return;
    const unit = prefill?.businessUnitId ? overview.businessUnits.find((u) => u.id === prefill.businessUnitId) : null;
    setGroupId(unit?.organizationGroupId || '');
    setIndustryId(unit?.industryId || '');
    setBusinessUnitId(prefill?.businessUnitId || '');
    setDocumentTypeId(prefill?.documentTypeId || '');
  }, [open, prefill, overview]);

  const businessUnits = useMemo(() => overview.businessUnits.filter((u) => (!groupId || u.organizationGroupId === groupId) && (!industryId || u.industryId === industryId)), [overview, groupId, industryId]);
  const documentTypes = useMemo(() => [...overview.documentTypes].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)), [overview]);
  const scopedPics = useMemo(() => pics.filter((p) => p.businessUnitId === businessUnitId), [pics, businessUnitId]);

  function submit(event) {
    event.preventDefault();
    const form = event.target;
    const file = form.file.files[0];
    const title = form.title.value.trim();
    const ownerId = form.ownerId.value;
    const reviewerId = form.reviewerId.value;
    if (!title || !businessUnitId || !documentTypeId || !ownerId || !reviewerId || !file) {
      alert('Lengkapi Group, Industry, BU, PIC, reviewer, jenis dokumen, dan file');
      return;
    }
    run({
      prepareUrl: '/api/documents/direct-upload-sessions', file,
      metadata: { businessUnitId, documentTypeId, ownerId, reviewerId, title, language: 'id', fileName: file.name, fileSize: file.size, contentType: file.type }
    });
  }

  return <Modal open={open} onClose={onClose} title={prefill ? `Tambah dokumen — ${prefill.documentTypeName}` : 'Buat SOP Baru'} width={560}>
    <p style={{ fontSize: 12, color: MUTED, background: '#f4f5f7', borderRadius: 8, padding: 10, marginBottom: 14 }}>
      {prefill ? <>Tambahkan dokumen <b>{prefill.documentTypeName}</b> untuk <b>{prefill.businessUnitName}</b>. Dokumen baru selalu dibuat sebagai <b>Draft v1.0</b>.</> : <>Dokumen baru selalu dibuat sebagai <b>Draft v1.0</b> dan perlu approval sebelum menjadi resmi.</>}
    </p>
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={labelStyle}>Nama dokumen</label>
        <input name="title" required placeholder="Contoh: Procurement Policy — Kebijakan Umum" style={fieldStyle} />
        <p style={{ fontSize: 10, color: MUTED, marginTop: 5 }}>Satu jenis dokumen dapat memiliki beberapa file untuk Business Unit yang sama. Beri nama yang spesifik agar mudah dibedakan.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={labelStyle}>Group</label><select value={groupId} onChange={(e) => { setGroupId(e.target.value); setBusinessUnitId(''); }} required style={fieldStyle}><option value="">Pilih Group</option>{overview.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div><label style={labelStyle}>Industry</label><select value={industryId} onChange={(e) => { setIndustryId(e.target.value); setBusinessUnitId(''); }} required style={fieldStyle}><option value="">Pilih Industry</option>{overview.industries.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
      </div>
      <div><label style={labelStyle}>Bisnis Unit</label><select value={businessUnitId} onChange={(e) => setBusinessUnitId(e.target.value)} required style={fieldStyle}><option value="">Pilih Business Unit</option>{businessUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
      <div><label style={labelStyle}>Jenis Dokumen</label><select value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} required style={fieldStyle}><option value="">Pilih jenis dokumen</option>{documentTypes.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}</select></div>
      <div>
        <label style={labelStyle}>PIC Penanggung Jawab</label>
        <select name="ownerId" required defaultValue="" style={fieldStyle}><option value="" disabled>{businessUnitId ? 'Pilih PIC' : 'Pilih Business Unit terlebih dahulu'}</option>{scopedPics.map((p) => <option key={p.id} value={p.id}>{p.name}{p.jobTitle ? ` — ${p.jobTitle}` : ''}</option>)}</select>
        <p style={{ fontSize: 10, color: MUTED, marginTop: 5 }}>PIC ditampilkan sesuai Business Unit. Tambahkan PIC baru dari menu Directory bila belum tersedia.</p>
      </div>
      <div>
        <label style={labelStyle}>Reviewer approval</label>
        <select name="reviewerId" required defaultValue="" style={fieldStyle}><option value="" disabled>Pilih reviewer dari Tim Procurement</option>{overview.reviewers.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.jobTitle || r.role}</option>)}</select>
        <p style={{ fontSize: 10, color: MUTED, marginTop: 5 }}>Hanya reviewer yang ditugaskan yang dapat approve draft ini.</p>
      </div>
      <div><label style={labelStyle}>Dokumen SOP</label><input name="file" type="file" accept=".pdf,.docx" required style={fieldStyle} /></div>
      <button type="submit" disabled={busy} style={{ padding: '0 16px', height: 36, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>{busy ? statusText : 'Buat SOP'}</button>
    </form>
  </Modal>;
}

export function UpdateSopModal({ open, onClose, documentId, overview, onUpdated }) {
  const [document, setDocument] = useState(null);
  const [error, setError] = useState(null);
  const { run, busy, statusText } = useUpload((result) => onUpdated(result));

  useEffect(() => {
    if (!open || !documentId) return;
    setDocument(null);
    setError(null);
    fetch(`/api/documents/${documentId}`).then(readJson).then(setDocument).catch((err) => setError(err.message));
  }, [open, documentId]);

  function submit(event) {
    event.preventDefault();
    const form = event.target;
    const file = form.file.files[0];
    const notes = form.changeSummary.value.trim();
    const reviewerId = form.reviewerId.value;
    if (!notes || !reviewerId || !file) { alert('Pilih file revisi, reviewer, dan isi catatan perubahan'); return; }
    run({ prepareUrl: `/api/documents/${document.id}/direct-upload-sessions`, file, metadata: { reviewerId, changeSummary: notes, fileName: file.name, fileSize: file.size, contentType: file.type } });
  }

  const hasFile = Boolean(document?.fileKey);
  const isPdf = hasFile && (document.contentType === 'application/pdf' || /\.pdf$/i.test(document.fileName || ''));

  return <Modal open={open} onClose={onClose} title="Update Dokumen SOP" subtitle="Upload revisi akan membuat versi baru dengan status Draft." width={560}>
    {error && <p style={{ fontSize: 13, color: '#b91c1c' }}>{error}</p>}
    {!error && !document && <p style={{ fontSize: 13, color: MUTED }}>Memuat riwayat versi…</p>}
    {document && <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label style={labelStyle}>SOP</label><input readOnly value={document.title} style={{ ...fieldStyle, background: '#f4f5f7' }} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={labelStyle}>Versi saat ini</label><input readOnly value={document.currentVersion || 'v1.0'} style={{ ...fieldStyle, background: '#f4f5f7' }} /></div>
        <div><label style={labelStyle}>Versi draft baru</label><input readOnly value={nextVersion(document.currentVersion)} style={{ ...fieldStyle, background: '#f4f5f7' }} /></div>
      </div>
      {hasFile && <div style={{ background: '#f4f5f7', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Dokumen versi saat ini</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isPdf && <a href={documentFileUrl(document.fileKey, true)} target="_blank" rel="noopener noreferrer" style={{ padding: '0 12px', height: 30, display: 'inline-flex', alignItems: 'center', borderRadius: 7, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12, fontWeight: 600 }}>Preview PDF</a>}
          <a href={documentFileUrl(document.fileKey, false)} download={document.fileName} style={{ padding: '0 12px', height: 30, display: 'inline-flex', alignItems: 'center', borderRadius: 7, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12, fontWeight: 600 }}>↓ Download</a>
        </div>
      </div>}
      {document.versionHistory?.length > 0 && <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 7 }}>Riwayat versi & catatan perubahan</div>
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, maxHeight: 150, overflow: 'auto' }}>
          {document.versionHistory.map((v) => (
            <div key={v.id} style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.versionNo}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: v.approvalStatus === 'APPROVED' ? '#15803d' : '#b45309' }}>{v.approvalStatus === 'APPROVED' ? 'Approved' : 'Draft'}</span>
              </div>
              <div style={{ fontSize: 11, marginTop: 6 }}>{v.changeSummary || 'Tidak ada catatan perubahan'}</div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{fmtDate(v.uploadedAt)}</div>
            </div>
          ))}
        </div>
      </div>}
      <div><label style={labelStyle}>Reviewer approval</label><select name="reviewerId" required defaultValue={document.reviewer?.id || ''} style={fieldStyle}><option value="" disabled>Pilih reviewer dari Tim Procurement</option>{overview.reviewers.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.jobTitle || r.role}</option>)}</select><p style={{ fontSize: 10, color: MUTED, marginTop: 5 }}>Draft hanya bisa di-approve oleh reviewer yang ditugaskan.</p></div>
      <div><label style={labelStyle}>Upload dokumen revisi</label><input name="file" type="file" accept=".pdf,.docx" required style={fieldStyle} /></div>
      <div><label style={labelStyle}>Catatan perubahan</label><textarea name="changeSummary" rows={3} required placeholder="Jelaskan perubahan pada versi ini..." style={{ ...fieldStyle, height: 'auto', padding: 8 }} /></div>
      <button type="submit" disabled={busy} style={{ padding: '0 16px', height: 36, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>{busy ? statusText : 'Simpan sebagai Draft'}</button>
    </form>}
  </Modal>;
}

export function SopDetailModal({ open, onClose, documentId, canManage, viewerId, onUpdate }) {
  const [document, setDocument] = useState(null);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !documentId) return;
    setDocument(null);
    setError(null);
    fetch(`/api/documents/${documentId}`).then(readJson).then(setDocument).catch((err) => setError(err.message));
  }, [open, documentId]);

  async function approve() {
    setApproving(true);
    try {
      await fetch(`/api/documents/${document.id}/approve`, { method: 'POST' }).then(readJson);
      onUpdate(null, true);
    } catch (err) {
      alert(err.message);
    } finally {
      setApproving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Hapus draft "${document.title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/documents/${document.id}`, { method: 'DELETE' }).then(readJson);
      onUpdate(null, true);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const hasFile = Boolean(document?.fileKey);
  const isPdf = hasFile && (document.contentType === 'application/pdf' || /\.pdf$/i.test(document.fileName || ''));
  const canApprove = canManage && document?.status === 'DRAFT' && document?.reviewer?.id === viewerId;
  const canDelete = canManage && document?.status === 'DRAFT';
  const actionStyle = { padding: '0 14px', height: 32, borderRadius: 7, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' };

  return <Modal open={open} onClose={onClose} title={document?.title} width={600}>
    {error && <p style={{ fontSize: 13, color: '#b91c1c' }}>{error}</p>}
    {!error && !document && <p style={{ fontSize: 13, color: MUTED }}>Memuat detail…</p>}
    {document && <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#eff1f4', color: MUTED }}>{document.id}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#eff1f4', color: MUTED }}>{document.currentVersion}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: document.status === 'APPROVED' ? '#dcfce7' : '#fef3c7', color: document.status === 'APPROVED' ? '#15803d' : '#b45309' }}>{document.status === 'APPROVED' ? 'Approved' : 'Draft'}</span>
      </div>
      <div style={{ background: '#f4f5f7', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>👤 Penanggung Jawab (PIC)</div>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{document.owner?.name || '—'}</div>
        <div style={{ fontSize: 12, color: MUTED }}>📧 {document.owner?.email || '—'}</div>
        <div style={{ fontSize: 12, color: MUTED }}>📱 {document.owner?.phone || '—'}</div>
        <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>Bisnis Unit: {document.businessUnit?.name}</div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>📋 Riwayat Versi</div>
      <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
        {(document.versionHistory || []).map((v, i) => {
          const actor = v.approvalStatus === 'APPROVED' ? (v.approvedBy?.name || 'Corporate Compliance') : (v.submittedBy?.name || '—');
          const meta = [`Dibuat oleh ${actor}`, v.reviewer ? `Reviewer: ${v.reviewer.name}` : null, v.approvedBy ? `Approved oleh ${v.approvedBy.name}` : null].filter(Boolean).join(' · ');
          return <div key={v.id} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? PRIMARY : BORDER, flexShrink: 0 }} />
              {i < document.versionHistory.length - 1 && <div style={{ width: 1, flex: 1, background: BORDER }} />}
            </div>
            <div>
              <div>
                <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#eff1f4', color: MUTED }}>{v.versionNo}</span>{' '}
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: v.approvalStatus === 'APPROVED' ? '#dcfce7' : '#fef3c7', color: v.approvalStatus === 'APPROVED' ? '#15803d' : '#b45309' }}>{v.approvalStatus === 'APPROVED' ? 'Approved' : 'Draft'}</span>{' '}
                <span style={{ fontSize: 10, color: MUTED }}>{fmtDate(v.uploadedAt)}</span>
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{v.changeSummary || 'Tidak ada catatan perubahan'}</div>
              <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.5 }}>{meta}</div>
            </div>
          </div>;
        })}
        {!document.versionHistory?.length && <p style={{ fontSize: 12, color: MUTED }}>Belum ada riwayat versi.</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        {document.status === 'DRAFT' && <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.45, maxWidth: 300 }}>Draft dibuat oleh <b style={{ color: FG }}>{document.submittedBy?.name || '—'}</b><br />Reviewer: <b style={{ color: FG }}>{document.reviewer?.name || '—'}</b></div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', marginLeft: 'auto' }}>
          {canManage && isPdf && <a href={documentFileUrl(document.fileKey, true)} target="_blank" rel="noopener noreferrer" style={actionStyle}>Preview</a>}
          {canManage && hasFile && <a href={documentFileUrl(document.fileKey, false)} download={document.fileName} style={actionStyle}>Download</a>}
          {canManage && <button onClick={() => onUpdate(document)} style={actionStyle}>Update</button>}
          {canDelete && <button disabled={deleting} onClick={remove} style={{ ...actionStyle, color: '#b91c1c', borderColor: '#f0caca' }}>{deleting ? 'Menghapus…' : 'Hapus'}</button>}
          {canApprove && <button disabled={approving} onClick={approve} style={{ ...actionStyle, background: PRIMARY, color: '#fff', border: 'none' }}>{approving ? 'Memproses…' : 'Approve'}</button>}
          <button onClick={onClose} style={actionStyle}>Tutup</button>
        </div>
      </div>
    </>}
  </Modal>;
}

export function RequirementDocumentsModal({ open, onClose, businessUnit, documentType, documents, onOpenDocument, onAddDocument }) {
  return <Modal open={open} onClose={onClose} title={documentType ? `${documentType.code} — ${documentType.name}` : ''} subtitle={businessUnit ? `${businessUnit.name} · ${documents.length} dokumen` : ''} width={560}>
    <div style={{ maxHeight: 360, overflow: 'auto' }}>
      {documents.length ? documents.map((doc) => (
        <div key={doc.id} style={{ padding: '13px 2px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{doc.title}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{doc.currentVersion} · {doc.fileName || 'Tanpa nama file'}</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: doc.status === 'APPROVED' ? '#dcfce7' : '#fef3c7', color: doc.status === 'APPROVED' ? '#15803d' : '#b45309' }}>{doc.status === 'APPROVED' ? 'Approved' : 'Draft'}</span>
          <button onClick={() => onOpenDocument(doc)} style={{ padding: '0 12px', height: 30, borderRadius: 7, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>Buka</button>
        </div>
      )) : <p style={{ padding: '22px 0', color: MUTED, fontSize: 12 }}>Belum ada dokumen.</p>}
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
      <button onClick={onClose} style={{ padding: '0 14px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Tutup</button>
      <button onClick={onAddDocument} style={{ padding: '0 14px', height: 32, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Tambah dokumen</button>
    </div>
  </Modal>;
}

export function MasterDataModal({ open, onClose, overview, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [editUnitId, setEditUnitId] = useState('');

  async function submitJson(url, method, body, form) {
    setBusy(true);
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await readJson(response);
      form?.reset();
      onChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  const editUnit = overview.businessUnits.find((u) => u.id === editUnitId);

  return <Modal open={open} onClose={onClose} title="Kelola Master Data" subtitle="Tambahkan struktur organisasi dan katalog dokumen yang akan digunakan dalam SOP Repository." width={760}>
    <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: .3, marginBottom: 10 }}>STRUKTUR ORGANISASI</div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
      <form onSubmit={(e) => { e.preventDefault(); submitJson('/api/master-data', 'POST', { kind: 'group', name: e.target.name.value.trim() }, e.target); }} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>◈ Group</div>
        <p style={{ fontSize: 11, color: MUTED, margin: '4px 0 8px' }}>Contoh: SMM, SMMA, atau Non Group.</p>
        <label style={labelStyle}>Nama group</label><input name="name" required placeholder="Contoh: SMM" style={{ ...fieldStyle, marginBottom: 10 }} />
        <button type="submit" disabled={busy} style={{ padding: '0 14px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Tambah Group</button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); submitJson('/api/master-data', 'POST', { kind: 'industry', name: e.target.name.value.trim() }, e.target); }} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>▦ Industry</div>
        <p style={{ fontSize: 11, color: MUTED, margin: '4px 0 8px' }}>Kategori industri untuk pengelompokan Business Unit.</p>
        <label style={labelStyle}>Nama industry</label><input name="name" required placeholder="Contoh: Financial Services" style={{ ...fieldStyle, marginBottom: 10 }} />
        <button type="submit" disabled={busy} style={{ padding: '0 14px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Tambah Industry</button>
      </form>
    </div>
    <form onSubmit={(e) => {
      e.preventDefault();
      const form = e.target;
      submitJson('/api/master-data', 'POST', { kind: 'businessUnit', name: form.name.value.trim(), organizationGroupId: form.organizationGroupId.value, industryId: form.industryId.value }, form);
    }} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>⌂ Business Unit</div>
      <p style={{ fontSize: 11, color: MUTED, margin: '4px 0 8px' }}>Hubungkan Business Unit ke Group dan Industry agar filter repository konsisten.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label style={labelStyle}>Nama Business Unit</label><input name="name" required placeholder="Contoh: NANOVEST" style={fieldStyle} /></div>
        <div><label style={labelStyle}>Group</label><select name="organizationGroupId" required defaultValue="" style={fieldStyle}><option value="" disabled>Pilih Group</option>{overview.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div><label style={labelStyle}>Industry</label><select name="industryId" required defaultValue="" style={fieldStyle}><option value="" disabled>Pilih Industry</option>{overview.industries.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
      </div>
      <button type="submit" disabled={busy} style={{ padding: '0 14px', height: 32, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Tambah Business Unit</button>
    </form>
    <form onSubmit={(e) => {
      e.preventDefault();
      const form = e.target;
      submitJson('/api/master-data', 'PATCH', { kind: 'businessUnit', businessUnitId: editUnitId, organizationGroupId: form.organizationGroupId.value, industryId: form.industryId.value }, null);
    }} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>↻ Perbarui Klasifikasi Business Unit</div>
      <p style={{ fontSize: 11, color: MUTED, margin: '4px 0 8px' }}>Ubah Group atau Industry Business Unit yang sudah ada. Nama Business Unit dan folder Google Drive tidak diubah.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label style={labelStyle}>Business Unit</label><select value={editUnitId} onChange={(e) => setEditUnitId(e.target.value)} required style={fieldStyle}><option value="">Pilih Business Unit</option>{overview.businessUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        <div><label style={labelStyle}>Group</label><select name="organizationGroupId" required defaultValue={editUnit?.organizationGroupId || ''} key={`g-${editUnitId}`} style={fieldStyle}><option value="" disabled>Pilih Group</option>{overview.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        <div><label style={labelStyle}>Industry</label><select name="industryId" required defaultValue={editUnit?.industryId || ''} key={`i-${editUnitId}`} style={fieldStyle}><option value="" disabled>Pilih Industry</option>{overview.industries.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></div>
      </div>
      <button type="submit" disabled={busy || !editUnitId} style={{ padding: '0 14px', height: 32, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Simpan Perubahan</button>
    </form>

    <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: .3, marginBottom: 10 }}>KATALOG DOKUMEN</div>
    <form onSubmit={(e) => {
      e.preventDefault();
      const form = e.target;
      submitJson('/api/master-data', 'POST', { kind: 'documentType', name: form.name.value.trim(), code: form.code.value.trim(), category: 'MANDATORY' }, form);
    }} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>▣ Jenis Dokumen SOP</div>
      <p style={{ fontSize: 11, color: MUTED, margin: '4px 0 8px' }}>Gunakan kode Mandatory berurutan (mis. M7). Seluruh dokumen tambahan berada dalam satu kategori <b>OTHER — Additional</b>.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) 110px 150px', gap: 10, marginBottom: 10 }}>
        <div><label style={labelStyle}>Nama jenis dokumen</label><input name="name" required placeholder="Contoh: Procurement Policy" style={fieldStyle} /></div>
        <div><label style={labelStyle}>Kode</label><input name="code" required placeholder="M7" style={fieldStyle} /></div>
        <div><label style={labelStyle}>Kategori</label><select disabled defaultValue="MANDATORY" style={fieldStyle}><option value="MANDATORY">Mandatory</option></select></div>
      </div>
      <button type="submit" disabled={busy} style={{ padding: '0 14px', height: 32, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Tambah Jenis Dokumen</button>
    </form>
  </Modal>;
}
