'use client';
import { useEffect, useRef, useState } from 'react';
import Modal from '../_shared/modal';
import { BORDER, CARD, FG, MUTED, PRIMARY } from '../_shared/tokens';

const fieldStyle = { fontSize: 13, padding: '0 12px', height: 36, borderRadius: 8, border: `1px solid ${BORDER}`, width: '100%' };
const labelStyle = { fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' };

export const CHANGE_LABEL = { ADDITION: 'Penambahan', REMOVAL: 'Pengurangan', AMENDMENT: 'Perubahan' };

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Permintaan gagal.');
  return payload;
}

// clientRequestKey is generated once when the modal opens and reused across
// retries within that session -- POST /api/requests treats a repeated key as
// the same request (idempotent), so a network retry can never double-submit.
export function ChangeRequestModal({ open, onClose, approvedSops, onCreated }) {
  const [busy, setBusy] = useState(false);
  const keyRef = useRef(null);

  useEffect(() => {
    if (open) keyRef.current = crypto.randomUUID();
  }, [open]);

  async function submit(event) {
    event.preventDefault();
    const form = event.target;
    const businessImpact = form.businessImpact.value.trim();
    setBusy(true);
    try {
      const result = await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientRequestKey: keyRef.current,
          sopDocumentId: form.sopDocumentId.value,
          title: form.title.value.trim(),
          clauseReference: form.clauseReference.value.trim(),
          changeType: form.changeType.value,
          currentText: form.currentText.value.trim(),
          proposedText: form.proposedText.value.trim(),
          businessImpact, description: businessImpact,
          priority: form.priority.value
        })
      }).then(readJson);
      form.reset();
      onClose();
      onCreated(result.duplicate);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return <Modal open={open} onClose={onClose} title="Ajukan Perubahan SOP" subtitle="Permintaan hanya dapat dibuat untuk SOP yang telah Approved." width={720}>
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label style={labelStyle}>SOP yang akan direvisi</label>
        <select name="sopDocumentId" required defaultValue="" style={fieldStyle}>
          <option value="" disabled>Pilih SOP yang sudah Approved</option>
          {approvedSops.map((sop) => <option key={sop.id} value={sop.id}>{sop.title} — {sop.businessUnit.name} ({sop.currentVersion})</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={labelStyle}>Referensi BAB / Pasal</label><input name="clauseReference" required placeholder="Contoh: BAB 3, Pasal 3.2" style={fieldStyle} /></div>
        <div><label style={labelStyle}>Jenis perubahan</label>
          <select name="changeType" required defaultValue="ADDITION" style={fieldStyle}>
            <option value="ADDITION">Penambahan</option><option value="REMOVAL">Pengurangan / penghapusan</option><option value="AMENDMENT">Perubahan / penyempurnaan</option>
          </select>
        </div>
      </div>
      <div><label style={labelStyle}>Judul singkat</label><input name="title" required placeholder="Contoh: Tambah evaluasi kualifikasi teknis vendor" style={fieldStyle} /></div>
      <div><label style={labelStyle}>Ketentuan saat ini <span style={{ color: MUTED, fontWeight: 400 }}>(opsional)</span></label><textarea name="currentText" rows={3} placeholder="Salin atau ringkas ketentuan yang berlaku saat ini..." style={{ ...fieldStyle, height: 'auto', padding: 8 }} /></div>
      <div><label style={labelStyle}>Usulan perubahan</label><textarea name="proposedText" rows={4} required placeholder="Jelaskan teks / proses baru yang diusulkan..." style={{ ...fieldStyle, height: 'auto', padding: 8 }} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
        <div><label style={labelStyle}>Alasan & dampak bisnis</label><textarea name="businessImpact" rows={3} required placeholder="Mengapa perubahan diperlukan dan apa dampaknya?" style={{ ...fieldStyle, height: 'auto', padding: 8 }} /></div>
        <div>
          <label style={labelStyle}>Prioritas</label>
          <select name="priority" defaultValue="MEDIUM" style={fieldStyle}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select>
          <p style={{ fontSize: 10, color: MUTED, lineHeight: 1.4, marginTop: 7 }}>Gunakan High/Critical bila terkait risiko kepatuhan atau regulator.</p>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onClose} style={{ padding: '0 14px', height: 34, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Batal</button>
        <button type="submit" disabled={busy} style={{ padding: '0 14px', height: 34, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>{busy ? 'Mengirim…' : 'Kirim ke Corporate Procurement'}</button>
      </div>
    </form>
  </Modal>;
}

function Message({ message, viewerId }) {
  const mine = message.senderId === viewerId;
  const corporate = ['SUPER_USER', 'CORPORATE_GOVERNANCE'].includes(message.sender?.role);
  return <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', margin: '7px 0' }}>
    <div style={{ maxWidth: '82%', padding: '9px 11px', borderRadius: 10, background: mine ? '#fbe7e7' : '#fff', border: `1px solid ${mine ? '#f0caca' : BORDER}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: corporate ? PRIMARY : MUTED }}>{message.sender?.name}{corporate ? ' · Corporate Governance' : ''}</div>
      <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 3 }}>{message.body}</div>
      <div style={{ fontSize: 9, color: MUTED, marginTop: 5 }}>{new Date(message.createdAt).toLocaleString('id-ID')}</div>
    </div>
  </div>;
}

export function ReviewRequestModal({ open, onClose, item, viewerId, canManage, onReplied, onReviewed }) {
  const [replyBody, setReplyBody] = useState('');
  const [status, setStatus] = useState('IN_REVIEW');
  const [comment, setComment] = useState('');
  const [busyReply, setBusyReply] = useState(false);
  const [busyReview, setBusyReview] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (!item) return;
    setStatus(['SUBMITTED', 'IN_REVIEW', 'REVISION_REQUIRED'].includes(item.status) ? (item.status === 'SUBMITTED' ? 'IN_REVIEW' : item.status) : 'IN_REVIEW');
    setComment(item.reviewerComment || '');
    setReplyBody('');
  }, [item?.id]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [item?.messages]);

  if (!item) return <Modal open={open} onClose={onClose} title="Review Permintaan" />;

  const closed = ['APPROVED', 'REJECTED'].includes(item.status);

  async function sendReply(event) {
    event.preventDefault();
    const body = replyBody.trim();
    if (!body) return;
    setBusyReply(true);
    try {
      await fetch(`/api/requests/${item.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) }).then(readJson);
      setReplyBody('');
      onReplied();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyReply(false);
    }
  }

  async function submitReview(event) {
    event.preventDefault();
    setBusyReview(true);
    try {
      await fetch(`/api/requests/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, reviewerComment: comment }) }).then(readJson);
      onReviewed();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyReview(false);
    }
  }

  return <Modal open={open} onClose={onClose} title={`Ticket: ${item.title}`} width={600}>
    <div style={{ background: '#f4f5f7', padding: 14, borderRadius: 8, marginBottom: 14, fontSize: 12, lineHeight: 1.55 }}>
      <b>{item.sopDocument?.title}</b><br />{item.sopDocument?.businessUnit?.name} · {item.clauseReference}
      <hr style={{ border: 0, borderTop: `1px solid ${BORDER}`, margin: '10px 0' }} />
      <b>Jenis:</b> {CHANGE_LABEL[item.changeType] || item.changeType}<br />
      <b>Usulan:</b> {item.proposedText}<br />
      <b>Dampak:</b> {item.businessImpact}
    </div>

    <div style={{ fontSize: 12, fontWeight: 700, margin: '16px 0 8px' }}>Percakapan ticket</div>
    <div ref={listRef} style={{ maxHeight: 230, overflow: 'auto', border: `1px solid ${BORDER}`, borderRadius: 9, padding: 10, background: '#fafbfc' }}>
      {item.messages?.length ? item.messages.map((m) => <Message key={m.id} message={m} viewerId={viewerId} />) : <div style={{ padding: 16, textAlign: 'center', fontSize: 11, color: MUTED }}>Belum ada percakapan. Gunakan pesan untuk meminta atau memberi klarifikasi.</div>}
    </div>
    {!closed && <form onSubmit={sendReply} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} rows={2} required placeholder="Tulis respons atau klarifikasi untuk ticket ini..." style={{ ...fieldStyle, flex: 1, height: 'auto', padding: 8 }} />
      <button type="submit" disabled={busyReply} style={{ alignSelf: 'flex-end', padding: '0 14px', height: 34, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: busyReply ? 'default' : 'pointer' }}>Kirim</button>
    </form>}

    {canManage && <form onSubmit={submitReview} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
      <div><label style={labelStyle}>Keputusan Corporate Procurement</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={fieldStyle}>
          <option value="IN_REVIEW">Mulai Review</option><option value="REVISION_REQUIRED">Minta Revisi dari BU</option><option value="APPROVED">Setujui untuk direvisi</option><option value="REJECTED">Tolak Permintaan</option>
        </select>
      </div>
      <div><label style={labelStyle}>Catatan reviewer</label><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} required placeholder="Tuliskan arahan atau alasan keputusan..." style={{ ...fieldStyle, height: 'auto', padding: 8 }} /></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={onClose} style={{ padding: '0 14px', height: 34, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Batal</button>
        <button type="submit" disabled={busyReview} style={{ padding: '0 14px', height: 34, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: busyReview ? 'default' : 'pointer' }}>Simpan Keputusan</button>
      </div>
    </form>}
  </Modal>;
}
