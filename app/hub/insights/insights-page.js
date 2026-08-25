'use client';
import { useEffect, useRef, useState } from 'react';
import HubHeader from '../_shared/hub-header';
import { BG, BORDER, CARD, FG, MUTED, MUTED_BG, PRIMARY, PRIMARY_SOFT } from '../_shared/tokens';

// Full-page "AI Copilot" -- the real chat (POST /api/ai/chat, the same
// endpoint and grounding/citation checks app/components/assistant-panel.js
// uses), replacing the fully scripted fake chatbot that used to live at
// nav "Insights" (getAIResponse() pattern-matching keywords into invented
// regulatory text). The left rail lists the actor's own past conversations
// (GET /api/ai/chat/conversations) as a read-only transcript log, per
// lib/ai/chat/transcript-service.js's own "UAT-quality and audit log, not
// general chat history" framing -- history is for review, not resuming.
//
// This file is a visual-only pass over that same wiring: every fetch, state
// transition, and API contract below is unchanged. Only the markup/styling
// changed -- suggestion cards, avatars, a typing indicator, and animation
// live in ChatStyles / new small components, none of it touches `ask()`,
// `viewHistory()`, `loadConversations()`, or `startNew()`.

const GREETING_TITLE = 'Ada yang bisa saya bantu?';
const GREETING_SUB = 'Tanyakan apa saja seputar Procurement Governance Hub — saya menjawab dari data yang boleh Anda akses.';
const DATA_SUMMARY_SUB = 'Mode ini menjawab langsung dari data Hub, bukan analisis AI. Cocok untuk pertanyaan daftar dan jumlah.';

const SUGGESTIONS = [
  { icon: '📄', text: 'SOP apa saja yang sedang menunggu review?' },
  { icon: '🏢', text: 'Business Unit mana yang dokumennya belum lengkap?' },
  { icon: '🔍', text: 'Ada temuan refinement yang perlu ditindaklanjuti?' },
  { icon: '📅', text: 'Apa saja jadwal audit terdekat?' }
];

const fmtDate = (value) => value ? new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const initial = (name) => (name || 'U').trim().charAt(0).toUpperCase();

function ChatStyles() {
  return <style>{`
    @keyframes copilotFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes copilotDot { 0%, 60%, 100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-4px); opacity: 1; } }
    @keyframes copilotGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(153,27,27,.18); } 50% { box-shadow: 0 0 0 6px rgba(153,27,27,0); } }
    .copilot-turn { animation: copilotFadeUp .25s ease-out; }
    .copilot-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${MUTED}; animation: copilotDot 1.1s ease-in-out infinite; }
    .copilot-dot:nth-child(2) { animation-delay: .15s; }
    .copilot-dot:nth-child(3) { animation-delay: .3s; }
    .copilot-avatar-live { animation: copilotGlow 2.4s ease-in-out infinite; }
    .copilot-scroll::-webkit-scrollbar { width: 8px; }
    .copilot-scroll::-webkit-scrollbar-track { background: transparent; }
    .copilot-scroll::-webkit-scrollbar-thumb { background: #d6d9de; border-radius: 999px; }
    .copilot-scroll::-webkit-scrollbar-thumb:hover { background: #c3c7cd; }
    .copilot-suggestion:hover { border-color: rgba(153,27,27,.35) !important; background: ${PRIMARY_SOFT} !important; transform: translateY(-1px); }
    .copilot-history-item:hover { background: ${MUTED_BG} !important; }
    .copilot-send:not(:disabled):hover { transform: scale(1.06); }
    .copilot-newchat:not(:disabled):hover { border-color: rgba(153,27,27,.35); color: ${PRIMARY}; }
  `}</style>;
}

function ModeBadge({ mode }) {
  if (mode !== 'DATA_SUMMARY') return null;
  return <span style={{ display: 'inline-block', marginBottom: 7, fontSize: 9.5, fontWeight: 700, letterSpacing: .3, padding: '2px 8px', borderRadius: 999, background: MUTED_BG, color: MUTED, textTransform: 'uppercase' }}>Ringkasan data · tanpa AI</span>;
}

function References({ items }) {
  if (!items?.length) return null;
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 9 }}>
    {items.slice(0, 6).map((item, index) => <span key={index} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: PRIMARY_SOFT, color: PRIMARY, border: '1px solid rgba(153,27,27,.18)' }}>📎 {item.label}</span>)}
  </div>;
}

function Avatar({ mine, letter }) {
  return <div aria-hidden="true" style={{
    width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
    fontSize: mine ? 11 : 13, fontWeight: 700,
    background: mine ? FG : `linear-gradient(135deg, ${PRIMARY}, #c0392b)`,
    color: '#fff', marginTop: 2
  }}>{mine ? letter : '✦'}</div>;
}

function TurnBubble({ turn, userLetter }) {
  return <div className="copilot-turn" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', gap: 9, alignSelf: 'flex-end', maxWidth: '80%', flexDirection: 'row-reverse' }}>
      <Avatar mine letter={userLetter} />
      <p style={{ padding: '10px 14px', borderRadius: '14px 14px 3px 14px', background: PRIMARY, color: '#fff', fontSize: 13, lineHeight: 1.55, boxShadow: '0 2px 8px rgba(153,27,27,.18)' }}>{turn.question}</p>
    </div>
    <div style={{ display: 'flex', gap: 9, alignSelf: 'flex-start', maxWidth: '84%' }}>
      <Avatar />
      <div style={{ padding: '11px 14px', borderRadius: '14px 14px 14px 3px', background: turn.error ? '#fef2f2' : CARD, border: turn.error ? '1px solid #fecaca' : `1px solid ${BORDER}`, fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap', boxShadow: '0 1px 3px rgba(15,23,42,.05)' }}>
        <ModeBadge mode={turn.mode} />
        {turn.answer}
        {turn.dataAvailable === false && !turn.error && <p style={{ marginTop: 7, fontSize: 11, color: MUTED }}>Belum tersedia di data Hub.</p>}
        <References items={turn.references} />
      </div>
    </div>
  </div>;
}

function TypingIndicator() {
  return <div style={{ display: 'flex', gap: 9, alignSelf: 'flex-start' }}>
    <Avatar />
    <div style={{ padding: '13px 16px', borderRadius: '14px 14px 14px 3px', background: CARD, border: `1px solid ${BORDER}`, display: 'flex', gap: 4, alignItems: 'center' }} role="status" aria-label="Memproses">
      <span className="copilot-dot" /><span className="copilot-dot" /><span className="copilot-dot" />
    </div>
  </div>;
}

function EmptyState({ dataSummary, onPick }) {
  return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
    <div className="copilot-avatar-live" style={{ width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(135deg, ${PRIMARY}, #c0392b)`, display: 'grid', placeItems: 'center', fontSize: 24, color: '#fff', marginBottom: 16 }}>✦</div>
    <h2 style={{ fontSize: 18, fontWeight: 700, color: FG, marginBottom: 6 }}>{GREETING_TITLE}</h2>
    <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, maxWidth: 420, marginBottom: 24 }}>{dataSummary ? DATA_SUMMARY_SUB : GREETING_SUB}</p>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 460 }}>
      {SUGGESTIONS.map((item) => (
        <button key={item.text} onClick={() => onPick(item.text)} className="copilot-suggestion" style={{
          display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', padding: '12px 13px', borderRadius: 11,
          border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer', fontSize: 12, color: FG, lineHeight: 1.4,
          transition: 'border-color .15s, background .15s, transform .15s'
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
          {item.text}
        </button>
      ))}
    </div>
  </div>;
}

export default function InsightsPage({ aiEnabled, chatMode, role, name }) {
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
  const inputRef = useRef(null);
  const userLetter = initial(name);

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
    event?.preventDefault();
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

  function pickSuggestion(text) {
    setQuestion(text);
    inputRef.current?.focus();
  }

  const viewing = viewingId !== null;
  const displayedTurns = viewing ? historyTurns : turns;
  const showEmpty = !displayedTurns?.length && !viewing;

  return <div style={{ minHeight: '100vh', background: BG }}>
    <ChatStyles />
    <HubHeader active="insights" role={role} />
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24, display: 'flex', gap: 20, alignItems: 'flex-start' }}>

      <aside style={{ width: 280, flexShrink: 0, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, boxShadow: '0 1px 3px rgba(15,23,42,.04)' }}>
        <button onClick={startNew} disabled={!aiEnabled || (!viewing && !turns.length)} className="copilot-newchat" style={{
          width: '100%', height: 38, borderRadius: 10, border: `1px solid ${BORDER}`, background: !viewing && !turns.length ? MUTED_BG : CARD,
          color: FG, fontSize: 12.5, fontWeight: 600, cursor: aiEnabled ? 'pointer' : 'default', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'border-color .15s, color .15s'
        }}><span style={{ fontSize: 14 }}>＋</span>Percakapan Baru</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: MUTED, letterSpacing: .4, marginBottom: 10, textTransform: 'uppercase' }}>
          <span>🕘</span>Riwayat Percakapan
        </div>
        {conversationsError && <p style={{ fontSize: 12, color: MUTED }}>Riwayat percakapan belum dapat dimuat.</p>}
        {!conversationsError && conversations === null && <p style={{ fontSize: 12, color: MUTED }}>Memuat…</p>}
        {!conversationsError && conversations?.length === 0 && <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>Belum ada percakapan. Mulai dengan bertanya sesuatu.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {conversations?.map((item) => (
            <button key={item.id} onClick={() => viewHistory(item.id)} className="copilot-history-item" style={{
              display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', padding: '9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: viewingId === item.id ? PRIMARY_SOFT : 'transparent', transition: 'background .15s'
            }}>
              <span style={{ fontSize: 13, flexShrink: 0, opacity: .7 }}>💬</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: viewingId === item.id ? PRIMARY : FG, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtDate(item.lastMessageAt)}</span>
                <span style={{ display: 'block', fontSize: 10.5, color: MUTED, marginTop: 1 }}>{item._count.messages} pesan</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main style={{ flex: 1, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)', minHeight: 480, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,.04)' }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${PRIMARY}, #e0847a, ${PRIMARY})`, flexShrink: 0 }} />
        <header style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden="true" className={aiEnabled && !viewing ? 'copilot-avatar-live' : ''} style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${PRIMARY}, #c0392b)`, color: '#fff', fontSize: 16, flexShrink: 0 }}>✦</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 14.5, color: FG }}>AI Copilot</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: MUTED }}>
              {aiEnabled && !viewing && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />}
              {viewing ? 'Melihat riwayat percakapan · read-only' : dataSummary ? 'Ringkasan data · tanpa AI' : 'Menjawab dari data yang boleh Anda akses'}
            </span>
          </span>
          {viewing && <button onClick={startNew} style={{ height: 32, padding: '0 14px', borderRadius: 999, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Percakapan Baru</button>}
        </header>

        {!aiEnabled ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', maxWidth: 320 }}>AI Copilot sedang dinonaktifkan oleh administrator.</p>
          </div>
        ) : <>
          <div ref={listRef} className="copilot-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {viewing && historyError && <p style={{ fontSize: 13, color: '#b91c1c' }}>Percakapan belum dapat dimuat. Silakan coba lagi.</p>}
            {viewing && !historyError && historyTurns === null && <p style={{ fontSize: 13, color: MUTED }}>Memuat percakapan…</p>}
            {showEmpty && <EmptyState dataSummary={dataSummary} onPick={pickSuggestion} />}
            {displayedTurns?.map((turn, index) => <TurnBubble key={index} turn={turn} userLetter={userLetter} />)}
            {busy && <TypingIndicator />}
          </div>

          <form onSubmit={ask} style={{ display: 'flex', gap: 10, padding: 16, borderTop: `1px solid ${BORDER}`, background: 'linear-gradient(to top, rgba(240,242,245,.5), transparent)' }}>
            <input ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} disabled={viewing}
              placeholder={viewing ? 'Klik "Percakapan Baru" untuk bertanya' : 'Tulis pertanyaan…'} aria-label="Pertanyaan untuk asisten"
              style={{ flex: 1, height: 46, padding: '0 18px', fontSize: 13.5, fontFamily: 'inherit', color: FG, border: `1px solid ${BORDER}`, borderRadius: 999, outline: 'none', background: viewing ? BG : CARD, boxShadow: viewing ? 'none' : 'inset 0 1px 2px rgba(15,23,42,.03)' }} />
            <button type="submit" disabled={viewing || busy || !question.trim()} className="copilot-send" aria-label="Kirim pertanyaan" style={{
              width: 46, height: 46, flexShrink: 0, border: 0, borderRadius: '50%', fontSize: 16,
              background: viewing || busy || !question.trim() ? '#d8dade' : `linear-gradient(135deg, ${PRIMARY}, #c0392b)`, color: '#fff',
              cursor: viewing || busy || !question.trim() ? 'default' : 'pointer', transition: 'transform .12s',
              boxShadow: viewing || busy || !question.trim() ? 'none' : '0 2px 8px rgba(153,27,27,.3)'
            }}>➤</button>
          </form>
        </>}
      </main>
    </div>
  </div>;
}
