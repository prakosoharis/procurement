'use client';
import { useEffect, useRef, useState } from 'react';
import HubHeader from '../_shared/hub-header';
import { BG, BORDER, CARD, FG, MUTED, MUTED_BG, PRIMARY } from '../_shared/tokens';

// Full-page "AI Copilot" -- the real chat (POST /api/ai/chat, the same
// endpoint and grounding/citation checks app/components/assistant-panel.js
// uses), replacing the fully scripted fake chatbot that used to live at
// nav "Insights" (getAIResponse() pattern-matching keywords into invented
// regulatory text). The left rail lists the actor's own past conversations
// (GET /api/ai/chat/conversations) as a read-only transcript log, per
// lib/ai/chat/transcript-service.js's own "UAT-quality and audit log, not
// general chat history" framing -- history is for review, not resuming.

const GREETING = 'Tanyakan informasi Procurement Governance Hub — misalnya SOP yang menunggu review, kelengkapan dokumen per Business Unit, temuan refinement, atau jadwal audit.';
const DATA_SUMMARY_GREETING = 'Mode ini menjawab langsung dari data Hub, bukan dengan analisis AI. Cocok untuk pertanyaan daftar dan jumlah: SOP yang menunggu review, Business Unit yang dokumennya belum lengkap, posisi yang lowong, atau jadwal audit mendatang.';

const fmtDate = (value) => value ? new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function ModeBadge({ mode }) {
  if (mode !== 'DATA_SUMMARY') return null;
  return <span style={{ display: 'inline-block', marginBottom: 6, fontSize: 9.5, fontWeight: 700, letterSpacing: .3, padding: '2px 7px', borderRadius: 999, background: '#eef1f5', color: MUTED, textTransform: 'uppercase' }}>Ringkasan data · tanpa AI</span>;
}

function References({ items }) {
  if (!items?.length) return null;
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
    {items.slice(0, 6).map((item, index) => <span key={index} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(153,27,27,.05)', color: PRIMARY, border: '1px solid rgba(153,27,27,.2)' }}>{item.label}</span>)}
  </div>;
}

function TurnBubble({ turn }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <p style={{ alignSelf: 'flex-end', maxWidth: '75%', padding: '9px 13px', borderRadius: '12px 12px 3px 12px', background: PRIMARY, color: '#fff', fontSize: 13, lineHeight: 1.5 }}>{turn.question}</p>
    <div style={{ alignSelf: 'flex-start', maxWidth: '80%', padding: '10px 13px', borderRadius: '12px 12px 12px 3px', background: turn.error ? '#fef2f2' : BG, border: turn.error ? '1px solid #fecaca' : `1px solid ${BORDER}`, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
      <ModeBadge mode={turn.mode} />
      {turn.answer}
      {turn.dataAvailable === false && !turn.error && <p style={{ marginTop: 6, fontSize: 11, color: MUTED }}>Belum tersedia di data Hub.</p>}
      <References items={turn.references} />
    </div>
  </div>;
}

export default function InsightsPage({ aiEnabled, chatMode, role }) {
  const dataSummary = chatMode === 'data-summary';
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState([]);
  const [conversations, setConversations] = useState(null);
  const [conversationsError, setConversationsError] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [historyTurns, setHistoryTurns] = useState(null);
  const [historyError, setHistoryError] = useState(false);
  const conversationIdRef = useRef(null);
  const listRef = useRef(null);

  async function loadConversations() {
    try {
      const response = await fetch('/api/ai/chat/conversations');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat riwayat');
      setConversations(data.conversations);
      setConversationsError(false);
    } catch {
      setConversationsError(true);
    }
  }

  useEffect(() => { if (aiEnabled) loadConversations(); }, [aiEnabled]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [turns, historyTurns, busy]);

  async function viewHistory(id) {
    setViewingId(id);
    setHistoryTurns(null);
    setHistoryError(false);
    try {
      const response = await fetch(`/api/ai/chat/conversations/${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat percakapan');
      setHistoryTurns(data.conversation.messages.map((message) => ({
        question: message.question, answer: message.answer, mode: message.mode,
        dataAvailable: message.dataAvailable, references: message.referencesJson
      })));
    } catch {
      setHistoryError(true);
    }
  }

  function startNew() {
    setViewingId(null);
    setHistoryTurns(null);
    setHistoryError(false);
  }

  async function ask(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;

    const isFirstTurn = !conversationIdRef.current;
    const history = turns.filter((turn) => !turn.error).flatMap((turn) => [
      { role: 'user', content: turn.question },
      { role: 'assistant', content: turn.answer }
    ]);

    setQuestion('');
    setBusy(true);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, history, conversationId: conversationIdRef.current })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setTurns((current) => [...current, { question: text, answer: payload.message || 'Layanan AI sedang tidak tersedia. Coba lagi nanti.', error: true }]);
      } else {
        if (payload.conversationId) conversationIdRef.current = payload.conversationId;
        setTurns((current) => [...current, { question: text, answer: payload.answer, references: payload.references, dataAvailable: payload.dataAvailable, mode: payload.mode }]);
        if (isFirstTurn) loadConversations();
      }
    } catch {
      setTurns((current) => [...current, { question: text, answer: 'Tidak dapat menghubungi layanan AI. Periksa koneksi Anda.', error: true }]);
    } finally {
      setBusy(false);
    }
  }

  const viewing = viewingId !== null;
  const displayedTurns = viewing ? historyTurns : turns;

  return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader active="insights" role={role} />
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24, display: 'flex', gap: 20, alignItems: 'flex-start' }}>

      <aside style={{ width: 280, flexShrink: 0, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
        <button onClick={startNew} disabled={!aiEnabled || (!viewing && !turns.length)} style={{
          width: '100%', height: 36, borderRadius: 8, border: `1px solid ${BORDER}`, background: !viewing && !turns.length ? MUTED_BG : CARD,
          color: FG, fontSize: 12.5, fontWeight: 600, cursor: aiEnabled ? 'pointer' : 'default', marginBottom: 14
        }}>+ Percakapan Baru</button>
        <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: .3, marginBottom: 8 }}>RIWAYAT PERCAKAPAN</div>
        {conversationsError && <p style={{ fontSize: 12, color: MUTED }}>Riwayat percakapan belum dapat dimuat.</p>}
        {!conversationsError && conversations === null && <p style={{ fontSize: 12, color: MUTED }}>Memuat…</p>}
        {!conversationsError && conversations?.length === 0 && <p style={{ fontSize: 12, color: MUTED }}>Belum ada percakapan.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {conversations?.map((item) => (
            <button key={item.id} onClick={() => viewHistory(item.id)} style={{
              textAlign: 'left', padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: viewingId === item.id ? 'rgba(153,27,27,.08)' : 'transparent'
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: viewingId === item.id ? PRIMARY : FG }}>{fmtDate(item.lastMessageAt)}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{item._count.messages} pesan</div>
            </button>
          ))}
        </div>
      </aside>

      <main style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)', minHeight: 480 }}>
        <header style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(153,27,27,.1)', color: PRIMARY, fontSize: 15 }}>✦</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 14, color: FG }}>AI Copilot</span>
            <span style={{ display: 'block', fontSize: 11, color: MUTED }}>{viewing ? 'Melihat riwayat percakapan · read-only' : dataSummary ? 'Ringkasan data · tanpa AI' : 'Menjawab dari data yang boleh Anda akses'}</span>
          </span>
          {viewing && <button onClick={startNew} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Percakapan Baru</button>}
        </header>

        {!aiEnabled ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', maxWidth: 320 }}>AI Copilot sedang dinonaktifkan oleh administrator.</p>
          </div>
        ) : <>
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {viewing && historyError && <p style={{ fontSize: 13, color: '#b91c1c' }}>Percakapan belum dapat dimuat. Silakan coba lagi.</p>}
            {viewing && !historyError && historyTurns === null && <p style={{ fontSize: 13, color: MUTED }}>Memuat percakapan…</p>}
            {!displayedTurns?.length && !viewing && <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, maxWidth: 480 }}>{dataSummary ? DATA_SUMMARY_GREETING : GREETING}</p>}
            {displayedTurns?.map((turn, index) => <TurnBubble key={index} turn={turn} />)}
            {busy && <p role="status" style={{ fontSize: 13, color: MUTED }}>Memproses…</p>}
          </div>

          <form onSubmit={ask} style={{ display: 'flex', gap: 10, padding: 14, borderTop: `1px solid ${BORDER}` }}>
            <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} disabled={viewing}
              placeholder={viewing ? 'Klik "Percakapan Baru" untuk bertanya' : 'Tulis pertanyaan…'} aria-label="Pertanyaan untuk asisten"
              style={{ flex: 1, height: 42, padding: '0 14px', fontSize: 13, fontFamily: 'inherit', color: FG, border: `1px solid ${BORDER}`, borderRadius: 9, outline: 'none', background: viewing ? BG : CARD }} />
            <button type="submit" disabled={viewing || busy || !question.trim()} style={{
              height: 42, padding: '0 18px', border: 0, borderRadius: 9, fontWeight: 600, fontSize: 13,
              background: viewing || busy || !question.trim() ? '#d8dade' : PRIMARY, color: '#fff', cursor: viewing || busy || !question.trim() ? 'default' : 'pointer'
            }}>Kirim</button>
          </form>
        </>}
      </main>
    </div>
  </div>;
}
