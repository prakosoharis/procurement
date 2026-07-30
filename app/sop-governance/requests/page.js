'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Requests() {
  const [requests, setRequests] = useState(null);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [conversionIntent, setConversionIntent] = useState('CREATE_REVISION');
  const [feedback, setFeedback] = useState('');

  const load = async () => {
    const response = await fetch('/api/governance/requests');
    const payload = await response.json();
    setRequests(payload.data || []);
    if (!response.ok) setFeedback(payload.error?.message || 'Requests could not be loaded.');
  };

  useEffect(() => {
    load();
    fetch('/api/governance/options')
      .then((response) => response.json())
      .then((payload) => setBusinessUnits(payload.data?.businessUnits || []));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setFeedback('');
    const form = event.currentTarget;
    const response = await fetch('/api/governance/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    const payload = await response.json();
    if (!response.ok) return setFeedback(payload.error?.message || 'Request could not be created.');
    form.reset();
    setConversionIntent('CREATE_REVISION');
    setShowCreate(false);
    setFeedback('Submission created. It can be reviewed before conversion.');
    await load();
  }

  return (
    <main className="native-page">
      <h1>SOP Requests</h1>
      <p>Submit, review, and discuss SOP change requests.</p>
      <button onClick={() => setShowCreate((visible) => !visible)}>
        {showCreate ? 'Cancel' : 'Create Request'}
      </button>
      {showCreate && (
        <form className="repository-card" onSubmit={submit}>
          <label>
            Submission type
            <select name="conversionIntent" value={conversionIntent} onChange={(event) => setConversionIntent(event.target.value)}>
              <option value="CREATE_REVISION">Change existing SOP</option>
              <option value="CREATE_SOP">Create new SOP</option>
            </select>
          </label>
          <input name="title" placeholder="Request title" required />
          {conversionIntent === 'CREATE_REVISION' ? (
            <input name="sopDocumentId" placeholder="Existing SOP ID" required />
          ) : (
            <label>
              Business Unit
              <select name="requestedBusinessUnitId" required>
                <option value="">Select Business Unit</option>
                {businessUnits.map((businessUnit) => (
                  <option key={businessUnit.id} value={businessUnit.id}>{businessUnit.name}</option>
                ))}
              </select>
            </label>
          )}
          <input name="changeType" placeholder="Change type" required />
          <input name="clauseReference" placeholder="Clause reference" required />
          <textarea name="description" placeholder="Business context" required />
          <textarea name="proposedText" placeholder="Proposed change" required />
          <button>Submit Request</button>
        </form>
      )}
      {feedback && <p role="status">{feedback}</p>}
      <section className="repository-card">
        <table>
          <thead><tr><th>Request</th><th>SOP</th><th>Status</th><th>Requester</th></tr></thead>
          <tbody>
            {!requests ? <tr><td colSpan="4">Loading…</td></tr> : requests.map((item) => (
              <tr key={item.requestId}>
                <td><Link href={`/sop-governance/requests/${item.requestId}`}>{item.title}</Link></td>
                <td>{item.sop?.title || 'New SOP'}</td>
                <td>{item.status}</td>
                <td>{item.requester?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
