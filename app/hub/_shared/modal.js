'use client';
import { BORDER, CARD, MUTED } from './tokens';

export default function Modal({ open, onClose, title, subtitle, width = 520, children }) {
  if (!open) return null;
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,18,28,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div onClick={(event) => event.stopPropagation()} style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, width: '100%', maxWidth: width, maxHeight: '85vh', overflow: 'auto', padding: 24, position: 'relative' }}>
      <button onClick={onClose} aria-label="Tutup" style={{ position: 'absolute', top: 14, right: 16, border: 'none', background: 'transparent', fontSize: 18, color: MUTED, cursor: 'pointer' }}>&times;</button>
      {title && <h3 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h3>}
      {subtitle && <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{subtitle}</p>}
      <div style={{ marginTop: title ? 16 : 0 }}>{children}</div>
    </div>
  </div>;
}
