'use client';
import { useEffect, useMemo, useState } from 'react';

// Design tokens lifted from the approved hub asset's :root block, matching the
// approximation AccountMenu/AssistantPanel already use for --primary so every
// React-shell element reads as one consistent surface. Not a redesign: same
// values, same radii, same badge palette as procurement-governance-hub.html.
const BG = '#f0f2f5';
const CARD = '#fff';
const FG = '#1a2236';
const PRIMARY = '#991b1b';
const PRIMARY_SOFT = 'rgba(153,27,27,0.08)';
const MUTED = '#6b7280';
const MUTED_BG = '#eff1f4';
const BORDER = '#e2e5ea';
const RADIUS = 10;

const BADGE = {
  green: { background: '#dcfce7', color: '#15803d' },
  amber: { background: '#fef3c7', color: '#b45309' },
  red: { background: '#fee2e2', color: '#b91c1c' },
  blue: { background: '#dbeafe', color: '#1d4ed8' },
  muted: { background: MUTED_BG, color: MUTED }
};

const RUN_STATUS_TONE = {
  QUEUED: 'muted', PREPARING: 'amber', RETRIEVING: 'amber', ANALYZING: 'amber',
  COMPLETED: 'green', FAILED: 'red', CANCELLED: 'muted'
};
const SEVERITY_TONE = { CRITICAL: 'red', HIGH: 'red', MEDIUM: 'amber', LOW: 'blue', OBSERVATION: 'muted' };
const DECISION_TONE = {
  PENDING: 'muted', ACCEPTED: 'green', ACCEPTED_WITH_MODIFICATION: 'blue',
  REJECTED: 'red', RETURNED_FOR_REFINEMENT: 'amber'
};

function Badge({ tone = 'muted', children }) {
  const palette = BADGE[tone] || BADGE.muted;
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, ...palette }}>{children}</span>;
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message || payload?.message || 'Permintaan gagal.');
  }
  return payload?.data ?? payload;
}

const canManage = (role) => ['SUPER_USER', 'CORPORATE_GOVERNANCE'].includes(role);

const NAV_ITEMS = [
  ['home', 'Home', '/'], ['repository', 'Repository', '/hub/repository'], ['refinement', 'Refinement', '/hub/refinement'],
  ['calendar', 'Calendar', '/hub/calendar'], ['engagement', 'Engagement', '/hub/engagement'], ['insights', 'Insights', '/hub/insights'],
  ['people', 'People', '/hub/people'], ['directory', 'Directory', '/hub/directory']
];

function HubHeader() {
  return <header style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0, zIndex: 50 }}>
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', gap: 16 }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: FG }}>Procurement Governance Hub</span>
      </a>
      <nav style={{ display: 'flex', gap: 2, marginLeft: 24 }}>
        {NAV_ITEMS.map(([key, label, href]) => (
          <a key={key} href={href} style={{
            padding: '8px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
            color: key === 'refinement' ? PRIMARY : MUTED, background: key === 'refinement' ? PRIMARY_SOFT : 'transparent'
          }}>{label}</a>
        ))}
      </nav>
    </div>
  </header>;
}

function EvidenceRow({ label, value }) {
  if (!value) return null;
  return <div style={{ fontSize: 12, marginBottom: 6 }}>
    <span style={{ color: MUTED, fontWeight: 600 }}>{label}: </span>
    <span style={{ color: FG }}>{value}</span>
  </div>;
}

function DecisionForm({ finding, runId, busy, onDecide }) {
  const [decision, setDecision] = useState('VALID');
  const [comment, setComment] = useState('');
  const [modified, setModified] = useState('');
  const needsComment = decision !== 'VALID';
  const needsModified = decision === 'REVISI';

  return <form onSubmit={(event) => { event.preventDefault(); onDecide(runId, finding.id, decision, comment, needsModified ? { modifiedRecommendation: modified } : {}); }}
    style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', gap: 6 }}>
      {[['VALID', 'Valid'], ['REVISI', 'Revisi'], ['ABAIKAN', 'Abaikan']].map(([value, label]) => (
        <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: decision === value ? PRIMARY : MUTED, cursor: 'pointer' }}>
          <input type="radio" name={`decision-${finding.id}`} checked={decision === value} onChange={() => setDecision(value)}
            style={{ width: 14, height: 14, padding: 0, margin: 0, border: '1px solid #9ca3af', borderRadius: '50%', background: '#fff', flexShrink: 0 }} /> {label}
        </label>
      ))}
    </div>
    {needsComment && <textarea required placeholder="Komentar reviewer (wajib)" value={comment} onChange={(event) => setComment(event.target.value)}
      style={{ fontSize: 12, padding: 8, borderRadius: 6, border: `1px solid ${BORDER}`, minHeight: 50, fontFamily: 'inherit' }} />}
    {needsModified && <textarea required placeholder="Rekomendasi hasil revisi (wajib)" value={modified} onChange={(event) => setModified(event.target.value)}
      style={{ fontSize: 12, padding: 8, borderRadius: 6, border: `1px solid ${BORDER}`, minHeight: 50, fontFamily: 'inherit' }} />}
    <button type="submit" disabled={busy} style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 6, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
      {busy ? 'Menyimpan…' : 'Simpan keputusan'}
    </button>
  </form>;
}

function FindingCard({ finding, runId, role, onDecide, decidingId }) {
  const evidence = finding.evidenceJson || {};
  return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Badge tone={SEVERITY_TONE[finding.severity] || 'muted'}>{finding.severity}</Badge>
        <Badge tone="muted">{finding.category}</Badge>
        <Badge tone={DECISION_TONE[finding.humanStatus] || 'muted'}>{finding.humanStatus}</Badge>
      </div>
      {typeof finding.confidence === 'number' && <span style={{ fontSize: 10, color: MUTED }}>keyakinan {Math.round(finding.confidence * 100)}%</span>}
    </div>
    <p style={{ fontSize: 13, fontWeight: 700, color: FG, marginTop: 8 }}>{evidence.title || finding.gap}</p>
    <p style={{ fontSize: 12.5, color: FG, marginTop: 4, lineHeight: 1.5 }}>{finding.gap}</p>
    <div style={{ marginTop: 8, padding: 10, background: BG, borderRadius: 8 }}>
      <EvidenceRow label="Bagian SOP" value={evidence.sopSection} />
      <EvidenceRow label="Bagian sumber" value={evidence.sourceSection} />
      <EvidenceRow label="Kutipan sumber" value={evidence.sourceQuote} />
      <EvidenceRow label="Justifikasi" value={evidence.justification} />
      <EvidenceRow label="Dampak" value={evidence.impact} />
      <EvidenceRow label="Sumber" value={evidence.sourceTitle} />
    </div>
    <p style={{ fontSize: 12.5, color: FG, marginTop: 8 }}><strong>Rekomendasi:</strong> {finding.recommendation}</p>
    {canManage(role) && finding.humanStatus === 'PENDING' && <DecisionForm finding={finding} runId={runId} busy={decidingId === finding.id} onDecide={onDecide} />}
  </div>;
}

function RunCard({ run, expanded, onToggle, role, onDecide, decidingId }) {
  return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, overflow: 'hidden' }}>
    <button onClick={onToggle} style={{ width: '100%', textAlign: 'left', padding: 14, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge tone={RUN_STATUS_TONE[run.status] || 'muted'}>{run.status}</Badge>
          {run.generatedOffline && <Badge tone="blue">Hasil offline · Claude Code</Badge>}
          {run.model && <span style={{ fontSize: 10, color: MUTED }}>{run.model}</span>}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
          {run.findingCount ?? run._count?.findings ?? 0} temuan kandidat · dimulai {run.startedAt ? new Date(run.startedAt).toLocaleString('id-ID') : '-'}
        </div>
      </div>
      <span style={{ fontSize: 11, color: MUTED }}>{expanded ? '▲ tutup' : '▼ lihat temuan'}</span>
    </button>
    {expanded && <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {run.detailError && <p style={{ fontSize: 12, color: '#b91c1c' }}>{run.detailError}</p>}
      {run.summary && <p style={{ fontSize: 12.5, color: FG, background: BG, padding: 10, borderRadius: 8 }}>{run.summary}</p>}
      {run.status === 'FAILED' && <p style={{ fontSize: 12, color: '#b91c1c' }}>Analisis gagal ({run.errorType || 'kesalahan tidak diketahui'}). Coba jalankan ulang.</p>}
      {(run.findings || []).map((finding) => <FindingCard key={finding.id} finding={finding} runId={run.id} role={role} onDecide={onDecide} decidingId={decidingId} />)}
      {run.status === 'COMPLETED' && (run.findings || []).length === 0 && <p style={{ fontSize: 12, color: MUTED }}>Tidak ada gap yang didukung bukti untuk kombinasi ini.</p>}
    </div>}
  </div>;
}

function StartRunForm({ sources, busy, onStart }) {
  const [selected, setSelected] = useState([]);
  const approved = sources.filter((source) => source.isApproved);

  function toggle(id) {
    setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  if (!approved.length) {
    return <p style={{ fontSize: 12, color: MUTED }}>Belum ada sumber pembanding yang berstatus approved untuk dipilih.</p>;
  }

  return <form onSubmit={(event) => { event.preventDefault(); if (selected.length) onStart(selected); }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>Pilih sumber pembanding approved</label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflow: 'auto', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8 }}>
      {approved.map((source) => (
        <label key={source.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: FG, cursor: 'pointer' }}>
          <input type="checkbox" checked={selected.includes(source.id)} onChange={() => toggle(source.id)}
            style={{ width: 16, height: 16, padding: 0, margin: 0, border: '1px solid #9ca3af', borderRadius: 4, background: '#fff', flexShrink: 0 }} />
          {source.title} <span style={{ color: MUTED, fontSize: 10.5 }}>({source.type})</span>
        </label>
      ))}
    </div>
    <button type="submit" disabled={busy || !selected.length} style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: (busy || !selected.length) ? 'default' : 'pointer', opacity: (busy || !selected.length) ? 0.6 : 1 }}>
      {busy ? 'Memulai…' : '+ Jalankan Analisis AI'}
    </button>
  </form>;
}

export default function RefinementWorkbench({ role }) {
  const [documents, setDocuments] = useState(null);
  const [documentsError, setDocumentsError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [selectedVersionId, setSelectedVersionId] = useState(null);

  const [sources, setSources] = useState([]);
  const [runs, setRuns] = useState(null);
  const [runsError, setRunsError] = useState(null);
  const [expandedRunId, setExpandedRunId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [decidingId, setDecidingId] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    fetch('/api/governance/sops?pageSize=100').then(readJson)
      .then((rows) => setDocuments(rows))
      .catch((error) => setDocumentsError(error.message));
    fetch('/api/references').then((response) => response.json()).then(setSources).catch(() => setSources([]));
  }, []);

  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    const query = search.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((document) => document.title.toLowerCase().includes(query) || document.businessUnit?.name?.toLowerCase().includes(query));
  }, [documents, search]);

  const selectedDocument = useMemo(() => documents?.find((document) => document.sopDocumentId === selectedDocId) || null, [documents, selectedDocId]);

  function selectDocument(document) {
    setSelectedDocId(document.sopDocumentId);
    setSelectedVersionId(document.latestVersion?.versionId || null);
    setRuns(null);
    setExpandedRunId(null);
    setNotice(null);
  }

  async function loadRuns(versionId) {
    setRuns(null);
    setRunsError(null);
    try {
      const rows = await fetch(`/api/governance/refinement/${versionId}/ai-runs`).then(readJson);
      setRuns(rows);
    } catch (error) {
      setRunsError(error.message);
      setRuns([]);
    }
  }

  useEffect(() => {
    if (selectedVersionId) loadRuns(selectedVersionId);
  }, [selectedVersionId]);

  async function loadRunDetail(runId) {
    try {
      const detail = await fetch(`/api/governance/refinement/${selectedVersionId}/ai-runs/${runId}`).then(readJson);
      setRuns((current) => current.map((row) => row.id === runId ? { ...row, ...detail, detailError: null } : row));
    } catch (error) {
      setRuns((current) => current.map((row) => row.id === runId ? { ...row, detailError: error.message } : row));
    }
  }

  async function toggleRun(run) {
    if (expandedRunId === run.id) { setExpandedRunId(null); return; }
    setExpandedRunId(run.id);
    if (run.findings) return;
    await loadRunDetail(run.id);
  }

  async function startRun(sourceIds) {
    setStarting(true);
    setNotice(null);
    try {
      await fetch(`/api/governance/refinement/${selectedVersionId}/ai-runs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceIds })
      }).then(readJson);
      setNotice({ tone: 'green', text: 'Analisis dimulai. Status akan diperbarui saat pekerjaan latar belakang berjalan.' });
      await loadRuns(selectedVersionId);
    } catch (error) {
      setNotice({ tone: 'red', text: error.message });
    } finally {
      setStarting(false);
    }
  }

  async function decide(runId, findingId, decision, comment, metadata) {
    setDecidingId(findingId);
    try {
      await fetch(`/api/governance/refinement/ai-findings/${findingId}/decision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, comment, metadata })
      }).then(readJson);
      // Re-fetch this run's DETAIL, not the list -- the list response has no
      // findings field, and replacing state with it would make every finding
      // in the expanded run vanish rather than show its updated status.
      await loadRunDetail(runId);
      setNotice({ tone: 'green', text: 'Keputusan tersimpan.' });
    } catch (error) {
      setNotice({ tone: 'red', text: error.message });
    } finally {
      setDecidingId(null);
    }
  }

  return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader />
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24, display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 20, alignItems: 'start' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: FG }}>Refinement</h2>
          <p style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>Analisis AI dibantu terhadap sumber pembanding yang sudah divalidasi.</p>
        </div>
        <input placeholder="Cari SOP atau Business Unit…" value={search} onChange={(event) => setSearch(event.target.value)}
          style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD }} />
        {documentsError && <p style={{ fontSize: 12, color: '#b91c1c' }}>{documentsError}</p>}
        {!documents && !documentsError && <p style={{ fontSize: 12, color: MUTED }}>Memuat daftar SOP…</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '70vh', overflow: 'auto' }}>
          {filteredDocuments.map((document) => (
            <button key={document.sopDocumentId} onClick={() => selectDocument(document)} style={{
              textAlign: 'left', padding: 12, borderRadius: RADIUS, cursor: 'pointer',
              border: `1px solid ${document.sopDocumentId === selectedDocId ? PRIMARY : BORDER}`,
              background: document.sopDocumentId === selectedDocId ? PRIMARY_SOFT : CARD
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: FG }}>{document.title}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{document.businessUnit?.name || '-'} · {document.latestVersion?.versionNumber || '-'}</div>
              {document.latestLifecycleState && <div style={{ marginTop: 4 }}><Badge tone="muted">{document.latestLifecycleState}</Badge></div>}
            </button>
          ))}
          {documents && !filteredDocuments.length && <p style={{ fontSize: 12, color: MUTED }}>Tidak ada SOP yang cocok.</p>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!selectedDocument && <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>
          Pilih SOP di sebelah kiri untuk melihat atau menjalankan analisis Refinement.
        </div>}

        {selectedDocument && <>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: RADIUS, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: FG }}>{selectedDocument.title}</h3>
                <p style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{selectedDocument.businessUnit?.name} · versi {selectedDocument.latestVersion?.versionNumber}</p>
              </div>
              {selectedDocument.latestLifecycleState && <Badge tone="muted">{selectedDocument.latestLifecycleState}</Badge>}
            </div>
            {canManage(role) ? <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
              <StartRunForm sources={sources} busy={starting} onStart={startRun} />
            </div> : <p style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>Menjalankan analisis baru hanya tersedia untuk Superuser dan Tim Procurement.</p>}
            {notice && <p style={{ marginTop: 10, fontSize: 12, padding: '8px 10px', borderRadius: 8, ...BADGE[notice.tone] }}>{notice.text}</p>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: FG }}>Riwayat analisis</h4>
            {runsError && <p style={{ fontSize: 12, color: '#b91c1c' }}>{runsError}</p>}
            {runs === null && !runsError && <p style={{ fontSize: 12, color: MUTED }}>Memuat riwayat analisis…</p>}
            {runs?.length === 0 && <p style={{ fontSize: 12, color: MUTED }}>Belum ada analisis AI untuk versi ini.</p>}
            {runs?.map((run) => (
              <RunCard key={run.id} run={run} expanded={expandedRunId === run.id} onToggle={() => toggleRun(run)} role={role} onDecide={decide} decidingId={decidingId} />
            ))}
          </div>
        </>}
      </div>
    </div>
  </div>;
}
