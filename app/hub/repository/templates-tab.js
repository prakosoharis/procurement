'use client';
import { useEffect, useMemo, useState } from 'react';
import Modal from '../_shared/modal';
import { BORDER, CARD, FG, MUTED, PRIMARY } from '../_shared/tokens';
import { documentFileUrl, fmtDate, readJson } from './repository-api';
import { bestTemplatesPerType } from '../../../lib/document-templates';

// Template library. A Business Unit picks its criteria, downloads the matching
// starting-point file, edits it and gets it approved OUTSIDE this application,
// then uploads the result as a Draft SOP through the normal "Buat SOP Baru"
// flow. Nothing here authors or alters document content.

const fieldStyle = { fontSize: 12.5, padding: '0 10px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD };
const labelStyle = { fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' };
const ALL = '__all__';

function scopeChip(value, label) {
  const isAll = !value;
  return <span style={{
    fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
    background: isAll ? '#eff1f4' : '#dbeafe', color: isAll ? MUTED : '#1d4ed8'
  }}>{isAll ? `Semua ${label}` : value.name}</span>;
}

export default function TemplatesTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [companySizeId, setCompanySizeId] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setData(await fetch('/api/document-templates', { cache: 'no-store' }).then(readJson));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  // Matching runs on the same helper the server-side tests cover, so the tab
  // and any future API consumer agree on which template wins.
  const matched = useMemo(() => {
    if (!data) return [];
    const request = { industryId: industryId || null, companySizeId: companySizeId || null };
    const best = bestTemplatesPerType(data.templates, request);
    return documentTypeId ? best.filter((t) => t.documentType.id === documentTypeId) : best;
  }, [data, documentTypeId, industryId, companySizeId]);

  async function upload(event) {
    event.preventDefault();
    const form = event.target;
    const file = form.file.files[0];
    if (!file) { alert('Pilih file template terlebih dahulu.'); return; }
    const body = new FormData();
    body.append('documentTypeId', form.documentTypeId.value);
    body.append('title', form.title.value.trim());
    body.append('description', form.description.value.trim());
    // An empty string means "applies to all" -- the server stores it as null.
    body.append('industryId', form.industryId.value === ALL ? '' : form.industryId.value);
    body.append('companySizeId', form.companySizeId.value === ALL ? '' : form.companySizeId.value);
    body.append('file', file);
    setBusy(true);
    try {
      await fetch('/api/document-templates', { method: 'POST', body }).then(readJson);
      setUploadOpen(false);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(template) {
    if (!window.confirm(`Hapus template "${template.title}"?`)) return;
    try {
      await fetch(`/api/document-templates/${template.id}`, { method: 'DELETE' }).then(readJson);
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  if (error) return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28, textAlign: 'center', color: '#b91c1c' }}>Template belum dapat dimuat. Silakan refresh halaman.</div>;
  if (!data) return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28, textAlign: 'center', color: MUTED }}>Memuat template…</div>;

  const { canManage } = data.viewer;
  const mandatoryTypes = data.documentTypes.filter((t) => t.category === 'MANDATORY');

  return <>
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700 }}>Template Dokumen</h3>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
          Pilih kriteria untuk menemukan template yang sesuai, lalu unduh sebagai titik awal. Sunting dan mintakan persetujuan di luar aplikasi, kemudian unggah hasilnya melalui <b>Buat SOP Baru</b> — dokumen akan masuk sebagai Draft.
        </p>
      </div>
      {canManage && <button onClick={() => setUploadOpen(true)} style={{ padding: '0 14px', height: 34, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>+ Unggah Template</button>}
    </div>

    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <select value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} style={{ ...fieldStyle, minWidth: 230 }}>
        <option value="">Semua jenis dokumen</option>
        {data.documentTypes.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
      </select>
      <select value={industryId} onChange={(e) => setIndustryId(e.target.value)} style={{ ...fieldStyle, width: 200 }}>
        <option value="">Semua Industry</option>
        {data.industries.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
      <select value={companySizeId} onChange={(e) => setCompanySizeId(e.target.value)} style={{ ...fieldStyle, width: 190 }}>
        <option value="">Semua Ukuran</option>
        {data.companySizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>

    {!data.companySizes.length && canManage && <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
      Kategori ukuran perusahaan belum diisi. Tambahkan lewat <b>⚙ Kelola Master Data</b> agar template dapat dibedakan berdasarkan ukuran.
    </div>}

    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'auto', background: CARD }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 860 }}>
        <thead><tr>{['Jenis Dokumen', 'Judul Template', 'Industry', 'Ukuran', 'File', 'Diperbarui', 'Aksi'].map((h) => (
          <th key={h} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, color: MUTED, fontWeight: 600, fontSize: 11 }}>{h}</th>
        ))}</tr></thead>
        <tbody>
          {matched.length ? matched.map((t) => (
            <tr key={t.id}>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: PRIMARY }}>{t.documentType.code}</span>
                <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>{t.documentType.name}</div>
              </td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>
                {t.title}
                {t.description && <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3, maxWidth: 320 }}>{t.description}</div>}
              </td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>{scopeChip(t.industry, 'Industry')}</td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>{scopeChip(t.companySize, 'Ukuran')}</td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, color: MUTED, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.fileName}</td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, color: MUTED }}>{fmtDate(t.updatedAt)}</td>
              <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <a href={documentFileUrl(t.fileKey, false)} download={t.fileName} style={{ height: 26, padding: '0 10px', borderRadius: 6, border: 'none', background: PRIMARY, color: '#fff', fontSize: 10.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>Unduh</a>
                  {canManage && <button onClick={() => remove(t)} style={{ height: 26, padding: '0 10px', borderRadius: 6, border: `1px solid #f0caca`, background: CARD, color: '#b91c1c', fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}>Hapus</button>}
                </div>
              </td>
            </tr>
          )) : <tr><td colSpan={7} style={{ textAlign: 'center', color: MUTED, padding: 28 }}>
            {data.templates.length
              ? 'Tidak ada template yang cocok dengan kriteria tersebut.'
              : 'Belum ada template. Tim Procurement dapat mengunggahnya lewat tombol di atas.'}
          </td></tr>}
        </tbody>
      </table>
    </div>

    {canManage && <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Unggah Template" subtitle="Satu kombinasi jenis dokumen, industry, dan ukuran hanya boleh memiliki satu template." width={560}>
      <form onSubmit={upload} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle}>Jenis dokumen</label>
          <select name="documentTypeId" required defaultValue="" style={{ ...fieldStyle, width: '100%', height: 36 }}>
            <option value="" disabled>Pilih jenis dokumen</option>
            {(mandatoryTypes.length ? mandatoryTypes : data.documentTypes).map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Judul template</label><input name="title" required maxLength={300} placeholder="Contoh: Procurement Policy — Pertambangan" style={{ ...fieldStyle, width: '100%', height: 36 }} /></div>
        <div><label style={labelStyle}>Keterangan <span style={{ color: MUTED, fontWeight: 400 }}>(opsional)</span></label><textarea name="description" rows={2} placeholder="Penjelasan singkat kapan template ini dipakai" style={{ ...fieldStyle, width: '100%', height: 'auto', padding: 8 }} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Industry</label>
            <select name="industryId" defaultValue={ALL} style={{ ...fieldStyle, width: '100%', height: 36 }}>
              <option value={ALL}>Semua Industry</option>
              {data.industries.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Ukuran perusahaan</label>
            <select name="companySizeId" defaultValue={ALL} style={{ ...fieldStyle, width: '100%', height: 36 }}>
              <option value={ALL}>Semua Ukuran</option>
              {data.companySizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <p style={{ fontSize: 10.5, color: MUTED, marginTop: -4, lineHeight: 1.45 }}>Pilih <b>Semua</b> bila template ini berlaku umum. Template yang lebih spesifik akan menang atas template umum saat pengguna mencari.</p>
        <div><label style={labelStyle}>File template</label><input name="file" type="file" required accept=".pdf,.docx" style={{ ...fieldStyle, width: '100%', height: 'auto', padding: 7 }} /><p style={{ fontSize: 10, color: MUTED, marginTop: 5 }}>PDF atau DOCX, maksimal 25 MB.</p></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={() => setUploadOpen(false)} style={{ padding: '0 14px', height: 34, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Batal</button>
          <button type="submit" disabled={busy} style={{ padding: '0 14px', height: 34, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>{busy ? 'Mengunggah…' : 'Unggah'}</button>
        </div>
      </form>
    </Modal>}
  </>;
}
