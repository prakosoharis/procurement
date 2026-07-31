'use client';

import { useEffect, useState } from 'react';

const CATEGORIES = [
  'REGULATORY_MISMATCH',
  'INTERNAL_POLICY_CONFLICT',
  'PROCESS_GAP',
  'CONTROL_WEAKNESS',
  'AMBIGUOUS_WORDING',
  'DUPLICATE_OR_INCONSISTENT_RULE',
  'ROLE_AND_RESPONSIBILITY_ISSUE',
  'AUDIT_OR_FRAUD_RISK',
  'DOCUMENT_QUALITY',
  'OTHER'
];
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'OBSERVATION'];
const EVIDENCE_TYPES = ['DOCUMENT_EXCERPT', 'REFERENCE_SOURCE', 'CLARIFICATION_RESPONSE', 'SUPPORTING_ATTACHMENT', 'REVIEWER_NOTE'];
const RESOLUTION_TYPES = ['DOCUMENT_UPDATED', 'CLARIFICATION_ACCEPTED', 'CONTROL_CONFIRMED', 'NO_CHANGE_REQUIRED', 'OTHER'];

const initialFinding = {
  title: '',
  category: 'PROCESS_GAP',
  categoryExplanation: '',
  severity: 'MEDIUM',
  observation: '',
  documentLocation: '',
  riskImpact: '',
  recommendation: '',
  blocking: false,
  blockingOverrideReason: ''
};

async function api(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'Request failed.');
    error.code = payload.error?.code;
    throw error;
  }
  return payload.data;
}

function asDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

function FindingForm({ value, onChange, submitLabel, onSubmit }) {
  return <form className="form" onSubmit={onSubmit}>
    <label>Finding title<input required value={value.title} onChange={event => onChange({ ...value, title: event.target.value })} /></label>
    <label>Category<select value={value.category} onChange={event => onChange({ ...value, category: event.target.value })}>{CATEGORIES.map(item => <option key={item}>{item}</option>)}</select></label>
    {value.category === 'OTHER' && <label>Category explanation<input required value={value.categoryExplanation || ''} onChange={event => onChange({ ...value, categoryExplanation: event.target.value })} /></label>}
    <label>Severity<select value={value.severity} onChange={event => onChange({ ...value, severity: event.target.value })}>{SEVERITIES.map(item => <option key={item}>{item}</option>)}</select></label>
    <label>Observation<textarea required value={value.observation} onChange={event => onChange({ ...value, observation: event.target.value })} /></label>
    <label>Document location<input value={value.documentLocation || ''} onChange={event => onChange({ ...value, documentLocation: event.target.value })} /></label>
    <label>Risk / impact<textarea value={value.riskImpact || ''} onChange={event => onChange({ ...value, riskImpact: event.target.value })} /></label>
    <label>Recommendation<textarea value={value.recommendation || ''} onChange={event => onChange({ ...value, recommendation: event.target.value })} /></label>
    <label><input type="checkbox" checked={Boolean(value.blocking)} onChange={event => onChange({ ...value, blocking: event.target.checked })} /> Blocking finding</label>
    <label>Blocking override reason<input value={value.blockingOverrideReason || ''} onChange={event => onChange({ ...value, blockingOverrideReason: event.target.value })} /></label>
    <button className="button" type="submit">{submitLabel}</button>
  </form>;
}

function FindingActions({ finding, versionId, businessUnitId, capabilities, onDone, setMessage }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: finding.title,
    category: finding.category,
    categoryExplanation: finding.categoryExplanation || '',
    severity: finding.severity,
    observation: finding.observation,
    documentLocation: finding.documentLocation || '',
    riskImpact: finding.riskImpact || '',
    recommendation: finding.recommendation || '',
    blocking: finding.blocking,
    blockingOverrideReason: finding.blockingOverrideReason || ''
  });
  const [evidence, setEvidence] = useState({ type: 'REVIEWER_NOTE', description: '', source: '', documentLocation: '' });
  const [clarification, setClarification] = useState({ question: '', dueAt: '' });
  const [disposition, setDisposition] = useState({ status: 'RESOLVED', resolutionType: 'CLARIFICATION_ACCEPTED', resolutionSummary: '', deferReason: '', deferOwner: '', deferTargetAt: '', riskAcknowledgement: '', dismissalReason: '' });

  const submit = async (endpoint, method, body, success) => {
    try {
      await api(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setMessage(success);
      await onDone();
      return true;
    } catch (cause) {
      setMessage(cause.code === 'CONCURRENT_MODIFICATION' ? 'This record changed elsewhere. Your input is still here; reload and compare before retrying.' : cause.message);
      return false;
    }
  };

  return <details className="repository-card">
    <summary>Finding detail and actions</summary>
    <p>Created by {finding.createdBy?.name || 'Unknown'} · {asDate(finding.createdAt)} · Last updated {asDate(finding.updatedAt)}</p>
    {capabilities.canManageFindings && ['OPEN', 'WAITING_FOR_CLARIFICATION'].includes(finding.status) && <>
      <button type="button" onClick={() => setEditing(!editing)}>{editing ? 'Close edit' : 'Edit finding'}</button>
      {editing && <FindingForm value={draft} onChange={setDraft} submitLabel="Save finding" onSubmit={async event => {
        event.preventDefault();
        if (await submit(`/api/governance/refinement/${versionId}/findings/${finding.id}`, 'PATCH', { ...draft, expectedUpdatedAt: finding.updatedAt }, 'Finding updated.')) setEditing(false);
      }} />}
    </>}

    {capabilities.canAddEvidence && <details>
      <summary>Add evidence</summary>
      <form className="form" onSubmit={async event => {
        event.preventDefault();
        if (await submit(`/api/governance/refinement/${versionId}/findings/${finding.id}/evidence`, 'POST', evidence, 'Evidence saved.')) setEvidence({ type: 'REVIEWER_NOTE', description: '', source: '', documentLocation: '' });
      }}>
        <label>Type<select value={evidence.type} onChange={event => setEvidence({ ...evidence, type: event.target.value })}>{EVIDENCE_TYPES.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Description<textarea required value={evidence.description} onChange={event => setEvidence({ ...evidence, description: event.target.value })} /></label>
        <label>Source<input value={evidence.source} onChange={event => setEvidence({ ...evidence, source: event.target.value })} /></label>
        <label>Document location<input value={evidence.documentLocation} onChange={event => setEvidence({ ...evidence, documentLocation: event.target.value })} /></label>
        <button className="button">Save evidence</button>
      </form>
    </details>}
    <section><h4>Evidence ({finding.evidence.length})</h4>{finding.evidence.length ? finding.evidence.map(item => <p key={item.id}><b>{item.type}</b> — {item.description} <small>· {item.addedBy?.name || 'Unknown'} · {asDate(item.createdAt)}</small></p>) : <p>No evidence recorded.</p>}</section>

    {capabilities.canRequestClarification && ['OPEN', 'WAITING_FOR_CLARIFICATION'].includes(finding.status) && <details>
      <summary>Request Business Unit clarification</summary>
      <form className="form" onSubmit={async event => {
        event.preventDefault();
        if (await submit(`/api/governance/refinement/${versionId}/findings/${finding.id}/clarifications`, 'POST', { ...clarification, requestedBusinessUnitId: businessUnitId }, 'Clarification requested.')) setClarification({ question: '', dueAt: '' });
      }}>
        <label>Question<textarea required value={clarification.question} onChange={event => setClarification({ ...clarification, question: event.target.value })} /></label>
        <label>Due date<input type="date" value={clarification.dueAt} onChange={event => setClarification({ ...clarification, dueAt: event.target.value })} /></label>
        <input type="hidden" value="" />
        <p>This request is securely assigned to the SOP's Business Unit.</p>
        <button className="button">Request clarification</button>
      </form>
    </details>}
    <section><h4>Clarifications ({finding.clarifications.length})</h4>{finding.clarifications.length ? finding.clarifications.map(item => <Clarification key={item.id} item={item} versionId={versionId} finding={finding} capabilities={capabilities} onDone={onDone} setMessage={setMessage} submit={submit} />) : <p>No clarification requested.</p>}</section>

    {capabilities.canDispositionFinding && ['OPEN', 'WAITING_FOR_CLARIFICATION'].includes(finding.status) && <details>
      <summary>Record disposition</summary>
      <form className="form" onSubmit={async event => {
        event.preventDefault();
        await submit(`/api/governance/refinement/${versionId}/findings/${finding.id}/disposition`, 'POST', { ...disposition, expectedUpdatedAt: finding.updatedAt }, 'Finding disposition recorded.');
      }}>
        <label>Disposition<select value={disposition.status} onChange={event => setDisposition({ ...disposition, status: event.target.value })}><option>RESOLVED</option><option>DEFERRED</option><option>DISMISSED</option></select></label>
        {disposition.status === 'RESOLVED' && <><label>Resolution type<select value={disposition.resolutionType} onChange={event => setDisposition({ ...disposition, resolutionType: event.target.value })}>{RESOLUTION_TYPES.map(item => <option key={item}>{item}</option>)}</select></label><label>Resolution summary<textarea required value={disposition.resolutionSummary} onChange={event => setDisposition({ ...disposition, resolutionSummary: event.target.value })} /></label></>}
        {disposition.status === 'DEFERRED' && <><label>Reason<textarea required value={disposition.deferReason} onChange={event => setDisposition({ ...disposition, deferReason: event.target.value })} /></label><label>Owner<input required value={disposition.deferOwner} onChange={event => setDisposition({ ...disposition, deferOwner: event.target.value })} /></label><label>Target date<input required type="date" value={disposition.deferTargetAt} onChange={event => setDisposition({ ...disposition, deferTargetAt: event.target.value })} /></label><label>Risk acknowledgement<textarea required value={disposition.riskAcknowledgement} onChange={event => setDisposition({ ...disposition, riskAcknowledgement: event.target.value })} /></label></>}
        {disposition.status === 'DISMISSED' && <label>Dismissal reason<textarea required value={disposition.dismissalReason} onChange={event => setDisposition({ ...disposition, dismissalReason: event.target.value })} /></label>}
        <button className="button">Save disposition</button>
      </form>
    </details>}
  </details>;
}

function Clarification({ item, versionId, finding, capabilities, onDone, setMessage, submit }) {
  const [response, setResponse] = useState(item.response || '');
  const [responseEvidence, setResponseEvidence] = useState(item.responseEvidence || '');
  return <article>
    <p><b>{item.status}</b> · To {item.requestedBusinessUnit?.name || 'Business Unit'} · due {asDate(item.dueAt)}</p>
    <p>{item.question}</p>
    {item.response && <p><b>Response:</b> {item.response}</p>}
    {capabilities.canRespondClarification && item.status === 'OPEN' && <form className="form" onSubmit={async event => {
      event.preventDefault();
      if (await submit(`/api/governance/refinement/clarifications/${item.id}/respond`, 'POST', { response, responseEvidence, expectedUpdatedAt: item.updatedAt }, 'Clarification response sent.')) { setResponse(''); setResponseEvidence(''); }
    }}>
      <label>Your response<textarea required value={response} onChange={event => setResponse(event.target.value)} /></label>
      <label>Supporting evidence (optional)<textarea value={responseEvidence} onChange={event => setResponseEvidence(event.target.value)} /></label>
      <button className="button">Send response</button>
    </form>}
    {capabilities.canCloseClarification && item.status === 'RESPONDED' && <button type="button" onClick={() => submit(`/api/governance/refinement/clarifications/${item.id}/close`, 'POST', { expectedUpdatedAt: item.updatedAt }, 'Clarification reviewed and closed.')}>Review and close clarification</button>}
  </article>;
}

export default function Workspace({ params }) {
  const [versionId, setVersionId] = useState('');
  const [data, setData] = useState(null);
  const [refs, setRefs] = useState([]);
  const [findings, setFindings] = useState([]);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(initialFinding);
  const [message, setMessage] = useState('');

  const load = async id => {
    try {
      const [workspace, references, findingList, activity] = await Promise.all([
        api(`/api/governance/refinement/${id}`),
        api(`/api/governance/refinement/${id}/references`),
        api(`/api/governance/refinement/${id}/findings`),
        api(`/api/governance/refinement/${id}/history`)
      ]);
      setData(workspace);
      setRefs(references);
      setFindings(findingList);
      setHistory(activity);
    } catch (cause) {
      setMessage(cause.message);
    }
  };

  useEffect(() => {
    params.then(({ versionId: id }) => { setVersionId(id); load(id); });
  }, [params]);

  if (!data) return <main className="native-page">Loading Refinement workspace…</main>;
  const capabilities = data.capabilities || {};

  return <main className="native-page">
    <header><p className="eyebrow">Human-only refinement</p><h1>{data.sop.title}</h1><p>{data.businessUnit.name} · {data.version}</p></header>
    {message && <p role="status">{message}</p>}
    <section className="repository-card"><h2>Document</h2><p>{data.file.name || 'No document attached'}</p>{data.file.key && <a className="button" href={`/api/files/download?key=${encodeURIComponent(data.file.key)}&mode=inline`}>Open document securely</a>}</section>
    <section className="repository-card"><h2>Reference set</h2>{refs.length ? refs.map(reference => <p key={reference.id}>{reference.referenceSource.title}</p>) : <p>No active reference selected yet.</p>}</section>
    <section className="repository-card">
      <h2>Human findings</h2>
      {capabilities.canManageFindings && <details open><summary>Create finding</summary><FindingForm value={form} onChange={setForm} submitLabel="Save finding" onSubmit={async event => {
        event.preventDefault();
        try {
          await api(`/api/governance/refinement/${versionId}/findings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
          setForm(initialFinding);
          setMessage('Finding saved.');
          await load(versionId);
        } catch (cause) { setMessage(cause.message); }
      }} /></details>}
      {!findings.length ? <p>No human finding recorded yet.</p> : findings.map(finding => <article className="repository-card" key={finding.id}>
        <h3>{finding.title}</h3><p><b>{finding.severity}</b> · {finding.status}{finding.blocking ? ' · Blocking' : ''}</p><p>{finding.observation}</p>
        <FindingActions finding={finding} versionId={versionId} businessUnitId={data.businessUnit.id} capabilities={capabilities} onDone={() => load(versionId)} setMessage={setMessage} />
      </article>)}
    </section>
    <section className="repository-card"><h2>Audit history</h2>{history.length ? history.map(item => <p key={item.id}><b>{item.action}</b> · {item.actor?.name || 'System'} · {asDate(item.createdAt)}</p>) : <p>No activity recorded yet.</p>}</section>
  </main>;
}
