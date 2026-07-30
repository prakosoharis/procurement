'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Requests() {
  const [requests, setRequests] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [feedback, setFeedback] = useState('');

  const load = async () => {
    const response = await fetch('/api/governance/requests');
    const payload = await response.json();
    setRequests(payload.data || []);
    if (!response.ok) setFeedback(payload.error?.message || 'Requests could not be loaded.');
  };

  useEffect(() => { load(); }, []);

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
    setShowCreate(false);
    setFeedback('Request created.');
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
          <input name="title" placeholder="Request title" required />
          <input name="sopDocumentId" placeholder="SOP ID" required />
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
                <td>{item.sop?.title || '—'}</td>
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
