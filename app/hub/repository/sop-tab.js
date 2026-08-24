'use client';
import { useEffect, useMemo, useState } from 'react';
import { BORDER, CARD, FG, MUTED, PRIMARY } from '../_shared/tokens';
import { fmtDate, readJson } from './repository-api';
import { CreateSopModal, MasterDataModal, RequirementDocumentsModal, SopDetailModal, UpdateSopModal } from './sop-modals';

// Faithful React port of the static hub's real, data-driven "SOP" tab:
// library table + filters, Document Compliance Matrix, and every admin
// modal (create, update, detail/approve, master data). Backed by
// GET /api/repository-overview, the same bulk load the original used.

const fieldStyle = { fontSize: 12.5, padding: '0 10px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD };
const STATUS_LABEL = { DRAFT: 'Draft', APPROVED: 'Approved', ARCHIVED: 'Archived' };
const STATUS_TONE = { DRAFT: { background: '#fef3c7', color: '#b45309' }, APPROVED: { background: '#dcfce7', color: '#15803d' }, ARCHIVED: { background: '#eff1f4', color: MUTED } };

function requirementKey(businessUnitId, documentTypeId) {
  return `${businessUnitId}|${documentTypeId}`;
}

export default function SopTab({ canManage, viewerId }) {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [pics, setPics] = useState([]);
  const [view, setView] = useState('library');
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [buId, setBuId] = useState('');

  const [createTarget, setCreateTarget] = useState(false); // false=closed, null=no prefill, {..}=prefilled
  const [updateDocumentId, setUpdateDocumentId] = useState(null);
  const [detailDocumentId, setDetailDocumentId] = useState(null);
  const [requirementModal, setRequirementModal] = useState(null);
  const [masterDataOpen, setMasterDataOpen] = useState(false);

  async function load() {
    try {
      const response = await fetch('/api/repository-overview', { cache: 'no-store' });
      setOverview(await readJson(response));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (canManage) fetch('/api/pics').then(readJson).then(setPics).catch(() => {});
  }, [canManage]);

  const businessUnitOptions = useMemo(() => !overview ? [] : overview.businessUnits.filter((u) => (!groupId || u.organizationGroupId === groupId) && (!industryId || u.industryId === industryId)), [overview, groupId, industryId]);

  const filteredDocuments = useMemo(() => {
    if (!overview) return [];
    const keyword = search.trim().toLowerCase();
    return overview.documents.filter((d) => {
      const bu = d.businessUnit;
      if (groupId && bu.organizationGroupId !== groupId) return false;
      if (industryId && bu.industryId !== industryId) return false;
      if (buId && bu.id !== buId) return false;
      if (keyword && !`${d.title} ${bu.name} ${bu.groupName} ${bu.industry}`.toLowerCase().includes(keyword)) return false;
      return true;
    });
  }, [overview, search, groupId, industryId, buId]);

  const matrix = useMemo(() => {
    if (!overview) return null;
    const mandatoryTypes = overview.documentTypes.filter((t) => t.category === 'MANDATORY').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const additionalTypes = overview.documentTypes.filter((t) => t.category === 'ADDITIONAL').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const byKey = {};
    overview.documents.forEach((d) => {
      if (!d.documentType) return;
      const key = requirementKey(d.businessUnit.id, d.documentType.id);
      (byKey[key] ||= []).push(d);
    });
    const stateOf = (unitId, typeId) => {
      const docs = byKey[requirementKey(unitId, typeId)] || [];
      if (!docs.length) return 'MISSING';
      return docs.some((d) => d.status === 'APPROVED') ? 'APPROVED' : 'DRAFT';
    };
    const rowUnits = overview.businessUnits.filter((u) => (!groupId || u.organizationGroupId === groupId) && (!industryId || u.industryId === industryId) && (!buId || u.id === buId));
    const mandatoryGaps = overview.businessUnits.reduce((total, unit) => total + mandatoryTypes.filter((t) => stateOf(unit.id, t.id) !== 'APPROVED').length, 0);
    return { mandatoryTypes, additionalTypes, byKey, stateOf, rowUnits, mandatoryGaps };
  }, [overview, groupId, industryId, buId]);

  if (error) return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28, textAlign: 'center', color: '#b91c1c' }}>Repository belum dapat dimuat. Silakan refresh halaman.</div>;
  if (!overview || !matrix) return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28, textAlign: 'center', color: MUTED }}>Memuat data repository…</div>;

  const draftCount = overview.documents.filter((d) => d.status === 'DRAFT').length;

  function openRequirementAction(businessUnit, documentType) {
    const docs = matrix.byKey[requirementKey(businessUnit.id, documentType.id)] || [];
    if (documentType.category === 'ADDITIONAL' || docs.length) {
      setRequirementModal({ businessUnit, documentType, documents: docs });
    } else {
      setCreateTarget({ businessUnitId: businessUnit.id, businessUnitName: businessUnit.name, documentTypeId: documentType.id, documentTypeName: documentType.name });
    }
  }

  return <>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      {canManage && <button onClick={() => setMasterDataOpen(true)} style={{ padding: '0 14px', height: 34, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>⚙ Kelola Master Data</button>}
      {canManage && <button onClick={() => setCreateTarget(null)} style={{ padding: '0 14px', height: 34, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>+ Buat SOP Baru</button>}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
      {[['Total Dokumen', overview.documents.length, FG, 'SOP dan policy terunggah'], ['Versi Draft', draftCount, '#b45309', 'Menunggu review / approval'], ['Mandatory Document Gaps', matrix.mandatoryGaps, PRIMARY, 'Perlu dilengkapi'], ['Business Units', overview.businessUnits.length, FG, 'Dengan document coverage']].map(([label, value, color, sub]) => (
        <div key={label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: MUTED }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{sub}</div>
        </div>
      ))}
    </div>

    <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${BORDER}` }}>
      {[['library', 'SOP Library & Versions'], ['compliance', 'Document Compliance']].map(([key, label]) => (
        <button key={key} onClick={() => setView(key)} style={{ padding: '9px 14px', border: 'none', borderBottom: `2px solid ${view === key ? PRIMARY : 'transparent'}`, background: 'transparent', color: view === key ? PRIMARY : MUTED, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
      ))}
    </div>

    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama SOP atau bisnis unit..." style={{ ...fieldStyle, minWidth: 220, flex: 1 }} />
      <select value={groupId} onChange={(e) => { setGroupId(e.target.value); setBuId(''); }} style={{ ...fieldStyle, width: 150 }}><option value="">Semua Group</option>{overview.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
      <select value={buId} onChange={(e) => setBuId(e.target.value)} style={{ ...fieldStyle, width: 190 }}><option value="">Semua Bisnis Unit</option>{businessUnitOptions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <select value={industryId} onChange={(e) => { setIndustryId(e.target.value); setBuId(''); }} style={{ ...fieldStyle, width: 180 }}><option value="">Semua Industry</option>{overview.industries.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
    </div>

    {view === 'library' ? (
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'auto', background: CARD }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 960 }}>
          <thead><tr>{['ID', 'Nama SOP', 'Group', 'Bisnis Unit', 'Industry', 'PIC', 'Versi', 'Status', 'Terakhir Diperbarui', 'Aksi'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, color: MUTED, fontWeight: 600, fontSize: 11 }}>{h}</th>)}</tr></thead>
          <tbody>
            {filteredDocuments.length ? filteredDocuments.map((d) => (
              <tr key={d.id} onClick={() => setDetailDocumentId(d.id)} style={{ cursor: 'pointer' }}>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, fontFamily: 'monospace', color: MUTED }}>{d.id.slice(0, 8)}</td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>{d.title}{d.status === 'DRAFT' && <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>Reviewer: {d.reviewer?.name || 'Belum ditugaskan'}</div>}</td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}><span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#eff1f4', color: MUTED }}>{d.businessUnit.groupName}</span></td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, color: MUTED }}>{d.businessUnit.name}</td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, color: MUTED }}>{d.businessUnit.industry}</td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>{d.owner?.name || '—'}</td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, fontFamily: 'monospace' }}>{d.currentVersion}</td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}><span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, ...STATUS_TONE[d.status] }}>{STATUS_LABEL[d.status] || d.status}</span></td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, color: MUTED }}>{fmtDate(d.uploadedAt)}</td>
                <td onClick={(e) => e.stopPropagation()} style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
                  {canManage ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => setUpdateDocumentId(d.id)} style={{ height: 26, padding: '0 10px', borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}>Update</button>
                    {d.status === 'DRAFT' && <button onClick={() => setDetailDocumentId(d.id)} style={{ height: 26, padding: '0 10px', borderRadius: 6, border: `1px solid ${BORDER}`, background: CARD, fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}>Review Draft</button>}
                  </div> : <span style={{ color: MUTED, fontSize: 11 }}>View only</span>}
                </td>
              </tr>
            )) : <tr><td colSpan={10} style={{ textAlign: 'center', color: MUTED, padding: 24 }}>Tidak ada SOP yang sesuai dengan filter.</td></tr>}
          </tbody>
        </table>
      </div>
    ) : (
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'auto', background: CARD }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11.5, minWidth: 960 }}>
          <thead><tr>
            <th style={{ textAlign: 'left', padding: '9px 10px', borderBottom: `1px solid ${BORDER}`, color: MUTED, fontSize: 11 }}>Group</th>
            <th style={{ textAlign: 'left', padding: '9px 10px', borderBottom: `1px solid ${BORDER}`, color: MUTED, fontSize: 11 }}>Business Unit</th>
            <th style={{ textAlign: 'left', padding: '9px 10px', borderBottom: `1px solid ${BORDER}`, color: MUTED, fontSize: 11 }}>Industry</th>
            {matrix.mandatoryTypes.map((t) => <th key={t.id} title={t.name} style={{ textAlign: 'center', minWidth: 62, padding: '9px 5px', borderBottom: `1px solid ${BORDER}` }}><span style={{ display: 'block', fontFamily: 'monospace', fontSize: 10, color: PRIMARY }}>{t.code}</span><span style={{ display: 'block', fontSize: 8, color: MUTED, marginTop: 2 }}>Wajib</span></th>)}
            {matrix.additionalTypes.map((t) => <th key={t.id} title={t.name} style={{ textAlign: 'center', minWidth: 62, padding: '9px 5px', borderBottom: `1px solid ${BORDER}` }}><span style={{ display: 'block', fontFamily: 'monospace', fontSize: 10, color: '#1d4ed8' }}>{t.code}</span><span style={{ display: 'block', fontSize: 8, color: MUTED, marginTop: 2 }}>Tambahan</span></th>)}
            <th style={{ textAlign: 'left', minWidth: 110, padding: '9px 10px', borderBottom: `1px solid ${BORDER}` }}>Coverage</th>
          </tr></thead>
          <tbody>
            {matrix.rowUnits.length ? matrix.rowUnits.map((unit) => {
              const mandatoryCount = matrix.mandatoryTypes.filter((t) => matrix.stateOf(unit.id, t.id) === 'APPROVED').length;
              const additionalCount = matrix.additionalTypes.filter((t) => (matrix.byKey[requirementKey(unit.id, t.id)] || []).length).length;
              return <tr key={unit.id}>
                <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}` }}><span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#eff1f4', color: MUTED }}>{unit.groupName}</span></td>
                <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, fontWeight: 700 }}>{unit.name}</td>
                <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: MUTED }}>{unit.industry}</td>
                {[...matrix.mandatoryTypes, ...matrix.additionalTypes].map((type) => {
                  const state = matrix.stateOf(unit.id, type.id);
                  const docs = matrix.byKey[requirementKey(unit.id, type.id)] || [];
                  const approved = state === 'APPROVED', draft = state === 'DRAFT';
                  const bg = approved ? '#dcfce7' : draft ? '#fef3c7' : '#fee2e2';
                  const fg = approved ? '#15803d' : draft ? '#b45309' : '#b91c1c';
                  return <td key={type.id} title={`${type.name}: ${approved ? 'Approved' : draft ? 'Draft' : 'Belum tersedia'} — klik untuk kelola${docs.length ? ` · ${docs.length} dokumen` : ''}`} style={{ textAlign: 'center', padding: '7px 5px', borderBottom: `1px solid ${BORDER}` }}>
                    <button onClick={() => openRequirementAction(unit, type)} style={{ display: 'inline-grid', placeItems: 'center', width: 22, height: 22, borderRadius: '50%', fontSize: 12, fontWeight: 700, border: 0, cursor: 'pointer', background: bg, color: fg }}>{approved ? '✓' : draft ? '◐' : '—'}</button>
                    {docs.length > 0 && <span style={{ display: 'block', marginTop: 3, fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: fg, lineHeight: 1 }}>{docs.length} file</span>}
                  </td>;
                })}
                <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: mandatoryCount === matrix.mandatoryTypes.length ? '#067647' : '#b91c1c' }}>M: {mandatoryCount}/{matrix.mandatoryTypes.length}</div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>Additional: {additionalCount}/{matrix.additionalTypes.length}</div>
                </td>
              </tr>;
            }) : <tr><td colSpan={4 + matrix.mandatoryTypes.length + matrix.additionalTypes.length} style={{ textAlign: 'center', color: MUTED, padding: 24 }}>Tidak ada business unit yang sesuai dengan filter.</td></tr>}
          </tbody>
        </table>
      </div>
    )}

    {canManage && <CreateSopModal
      open={createTarget !== false} onClose={() => setCreateTarget(false)}
      overview={overview} pics={pics} prefill={createTarget}
      onCreated={(result) => { setCreateTarget(false); load(); alert(`Dokumen disimpan sebagai Draft v1.0 untuk direview oleh ${result.reviewer?.name || 'reviewer'}`); }} />}

    {canManage && <UpdateSopModal
      open={!!updateDocumentId} onClose={() => setUpdateDocumentId(null)}
      documentId={updateDocumentId} overview={overview}
      onUpdated={(result) => { setUpdateDocumentId(null); load(); alert(`Versi ${result.version} disimpan sebagai Draft untuk direview oleh ${result.reviewer?.name || 'reviewer'}`); }} />}

    <SopDetailModal
      open={!!detailDocumentId} onClose={() => setDetailDocumentId(null)}
      documentId={detailDocumentId} canManage={canManage} viewerId={viewerId}
      onUpdate={(document, approved) => {
        setDetailDocumentId(null);
        if (approved) { load(); return; }
        if (document) setUpdateDocumentId(document.id);
      }} />

    {canManage && <RequirementDocumentsModal
      open={!!requirementModal} onClose={() => setRequirementModal(null)}
      businessUnit={requirementModal?.businessUnit} documentType={requirementModal?.documentType} documents={requirementModal?.documents || []}
      onOpenDocument={(doc) => { setRequirementModal(null); setDetailDocumentId(doc.id); }}
      onAddDocument={() => { const ctx = requirementModal; setRequirementModal(null); setCreateTarget({ businessUnitId: ctx.businessUnit.id, businessUnitName: ctx.businessUnit.name, documentTypeId: ctx.documentType.id, documentTypeName: ctx.documentType.name }); }} />}

    {canManage && <MasterDataModal open={masterDataOpen} onClose={() => setMasterDataOpen(false)} overview={overview} onChanged={() => { load(); }} />}
  </>;
}
