'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { shouldShowSubmissionConversionAction } from '../../../../lib/governance/requests/submission-conversion-ui';

export default function RequestDetail({ params }) {
  const [requestId, setRequestId] = useState('');
  const [request, setRequest] = useState(null);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);

  const load = useCallback(async (id) => {
    const response = await fetch(`/api/governance/requests/${id}`);
    const payload = await response.json();
    if (!response.ok) {
      setFeedback(payload.error?.message || 'Request could not be loaded.');
      return;
    }
    setRequest(payload.data);
  }, []);

  useEffect(() => {
    params.then(({ requestId: resolvedId }) => {
      setRequestId(resolvedId);
      load(resolvedId);
    });
  }, [load, params]);

  async function sendMessage(event) {
    event.preventDefault();
    setFeedback('');
    setSending(true);

    try {
      const response = await fetch(`/api/governance/requests/${requestId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: message })
      });
      const payload = await response.json();
      if (!response.ok) {
        setFeedback(payload.error?.message || 'Message could not be sent.');
        return;
      }

      setMessage('');
      setFeedback('Message sent.');
      await load(requestId);
    } catch {
      setFeedback('Message could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function convertSubmission() {
    setFeedback('');
    setConverting(true);

    try {
      const response = await fetch(`/api/governance/requests/${requestId}/conversion`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedStatus: 'APPROVED',
          expectedUpdatedAt: request.updatedAt
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setFeedback(payload.error?.message || 'Submission could not be converted.');
        return;
      }

      setFeedback(payload.data.idempotent
        ? 'This submission was already converted. The existing draft is shown below.'
        : 'Submission converted to a controlled SOP draft.');
      await load(requestId);
    } catch {
      setFeedback('Submission could not be converted. Please try again.');
    } finally {
      setConverting(false);
    }
  }

  if (!request) {
    return <main className="native-page">{feedback || 'Loading request…'}</main>;
  }

  const isClosed = ['APPROVED', 'REJECTED'].includes(request.status);
  const canConvert = shouldShowSubmissionConversionAction(request);

  return (
    <main className="native-page">
      <Link href="/sop-governance/requests">← SOP Requests</Link>
      <header>
        <h1>{request.title}</h1>
        <p>{request.status} · {request.requestType}</p>
      </header>

      <section className="repository-card">
        <p>{request.description || 'No business context supplied.'}</p>
        <p><b>Proposed change:</b> {request.proposedText || '—'}</p>
      </section>

      {(canConvert || request.conversion) && (
        <section className="repository-card">
          <h2>Controlled SOP conversion</h2>
          {request.conversion ? (
            <>
              <p>This approved submission has been converted to a {request.conversion.mode === 'CREATE_SOP' ? 'new SOP draft' : 'revision draft'}.</p>
              <Link href={`/sop-governance/repository/${request.conversion.sopDocumentId}`}>
                Open generated SOP draft →
              </Link>
            </>
          ) : (
            <>
              <p>This creates a draft only. It does not approve or publish the SOP.</p>
              <button onClick={convertSubmission} disabled={converting}>
                {converting ? 'Converting…' : 'Convert to SOP Draft'}
              </button>
            </>
          )}
        </section>
      )}

      <section className="repository-card">
        <h2>Discussion</h2>
        {request.messages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          <div className="request-message-list">
            {request.messages.map((item) => (
              <article key={item.id} className="request-message">
                <p><b>{item.sender.name}</b> <span>{item.sender.role}</span></p>
                <p>{item.body}</p>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </article>
            ))}
          </div>
        )}

        {request.capabilities?.canAddDiscussionMessage && (
          <form onSubmit={sendMessage} className="request-message-form">
            <label htmlFor="request-message">Add a response</label>
            <textarea
              id="request-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write a clear response for this request"
              required
              disabled={sending}
            />
            <button disabled={sending}>{sending ? 'Sending…' : 'Send response'}</button>
          </form>
        )}
        {isClosed && <p>This request is closed and its discussion is read-only.</p>}
        {!isClosed && !request.capabilities?.canAddDiscussionMessage && (
          <p>Your role has read-only access to this discussion.</p>
        )}
      </section>
      {feedback && <p role="status">{feedback}</p>}
    </main>
  );
}
