'use client';
import { useEffect, useRef, useState } from 'react';

// Chat lives in the React shell as a sibling of the hub iframe, so the approved
// 264 KB interface asset is not modified and cannot regress. Colours follow the
// hub design tokens.
const PRIMARY = '#991b1b';
const BORDER = '#e2e5ea';
const MUTED = '#6b7280';

const GREETING = 'Tanyakan informasi Procurement Governance Hub — misalnya SOP yang menunggu review, kelengkapan dokumen per Business Unit, temuan refinement, atau jadwal audit.';

function References({ items }) {
  if (!items?.length) return null;
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
    {items.slice(0, 6).map((item, index) => <span key={index} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(153,27,27,.05)', color: PRIMARY, border: '1px solid rgba(153,27,27,.2)' }}>{item.label}</span>)}
  </div>;
}

export default function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState([]);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [turns, busy]);

  useEffect(() => {
    function onKeyDown(event) { if (event.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function ask(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;

    // Send only completed exchanges as history; the server trims and validates.
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
        body: JSON.stringify({ question: text, history })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setTurns((current) => [...current, { question: text, answer: payload.message || 'Layanan AI sedang tidak tersedia. Coba lagi nanti.', error: true }]);
      } else {
        setTurns((current) => [...current, { question: text, answer: payload.answer, references: payload.references, dataAvailable: payload.dataAvailable }]);
      }
    } catch {
      setTurns((current) => [...current, { question: text, answer: 'Tidak dapat menghubungi layanan AI. Periksa koneksi Anda.', error: true }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} aria-label="Buka asisten Procurement Governance Hub" style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 200, height: 52, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 9, border: 0, borderRadius: 999, background: PRIMARY, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif', boxShadow: '0 6px 20px rgba(153,27,27,.28)' }}>
      <span aria-hidden="true" style={{ fontSize: 16 }}>✦</span> Asisten
    </button>;
  }

  return <section aria-label="Asisten Procurement Governance Hub" style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 200, width: 'min(400px, calc(100vw - 44px))', height: 'min(560px, calc(100vh - 44px))', display: 'flex', flexDirection: 'column', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: '0 18px 45px rgba(0,0,0,.18)', fontFamily: 'Inter, system-ui, sans-serif', color: '#1a2236' }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderBottom: `1px solid ${BORDER}` }}>
      <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(153,27,27,.1)', color: PRIMARY, fontSize: 14 }}>✦</span>
      <span style={{ flex: 1, lineHeight: 1.25 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>Asisten Hub</span>
        <span style={{ display: 'block', fontSize: 10, color: MUTED }}>Menjawab dari data yang boleh Anda akses</span>
      </span>
      <button onClick={() => setOpen(false)} aria-label="Tutup asisten" style={{ border: 0, background: 'transparent', color: MUTED, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
    </header>

    <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!turns.length && <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.55 }}>{GREETING}</p>}
      {turns.map((turn, index) => <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: '8px 11px', borderRadius: '10px 10px 2px 10px', background: PRIMARY, color: '#fff', fontSize: 12.5, lineHeight: 1.5 }}>{turn.question}</p>
        <div style={{ alignSelf: 'flex-start', maxWidth: '92%', padding: '9px 11px', borderRadius: '10px 10px 10px 2px', background: turn.error ? '#fef2f2' : '#f4f5f7', border: turn.error ? '1px solid #fecaca' : 0, fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          {turn.answer}
          {turn.dataAvailable === false && !turn.error && <p style={{ marginTop: 6, fontSize: 10.5, color: MUTED }}>Belum tersedia di data Hub.</p>}
          <References items={turn.references} />
        </div>
      </div>)}
      {busy && <p role="status" style={{ alignSelf: 'flex-start', fontSize: 12, color: MUTED, padding: '8px 11px' }}>Memproses…</p>}
    </div>

    <form onSubmit={ask} style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${BORDER}` }}>
      <input ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} placeholder="Tulis pertanyaan…" aria-label="Pertanyaan untuk asisten" style={{ flex: 1, height: 38, padding: '0 12px', fontSize: 12.5, fontFamily: 'inherit', color: '#1a2236', border: `1px solid ${BORDER}`, borderRadius: 9, outline: 'none' }} />
      <button type="submit" disabled={busy || !question.trim()} style={{ height: 38, padding: '0 15px', border: 0, borderRadius: 9, background: busy || !question.trim() ? '#d8dade' : PRIMARY, color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: busy || !question.trim() ? 'default' : 'pointer' }}>Kirim</button>
    </form>
  </section>;
}
