'use client';

import { useState } from 'react';
import { roleDisplayName } from '../../lib/authorization/roles';

export default function AccountMenu({ name, role }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  }
  function connectGoogleDrive() {
    window.location.assign('/api/integrations/google-drive/connect');
  }
  return <div style={{ position: 'fixed', top: 9, right: 22, zIndex: 200 }}>
    <button onClick={() => setOpen(!open)} aria-expanded={open} style={{ height: 46, display: 'flex', alignItems: 'center', gap: 9, padding: '5px 8px 5px 11px', border: 0, borderRadius: 8, background: 'rgba(255,255,255,.96)', cursor: 'pointer', color: '#1a2236', boxShadow: open ? '0 2px 10px rgba(0,0,0,.10)' : 'none' }}>
      <span style={{ width: 31, height: 31, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(153,27,27,.1)', color: '#991b1b', fontWeight: 700, fontSize: 12 }}>{name.split(' ').map(x => x[0]).join('').slice(0, 2)}</span>
      <span style={{ textAlign: 'left', lineHeight: 1.2 }}><span style={{ display: 'block', fontWeight: 600, fontSize: 12 }}>{name}</span><span style={{ display: 'block', color: '#6b7280', fontSize: 10 }}>{roleDisplayName(role)}</span></span>
      <span style={{ color: '#6b7280', fontSize: 14 }}>⌄</span>
    </button>
    {open && <div style={{ position: 'absolute', right: 0, top: 51, minWidth: 182, border: '1px solid #e2e5ea', borderRadius: 9, background: '#fff', padding: 6, boxShadow: '0 10px 25px rgba(0,0,0,.13)' }}>
      <div style={{ padding: '8px 10px 9px', borderBottom: '1px solid #eef0f3', fontSize: 11, color: '#6b7280' }}>Sesi aktif</div>
      {['SUPER_USER', 'CORPORATE_GOVERNANCE'].includes(role) && <button onClick={connectGoogleDrive} style={{ width: '100%', marginTop: 4, padding: '9px 10px', border: 0, borderRadius: 6, textAlign: 'left', background: 'transparent', color: '#1d4ed8', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>▣ Hubungkan Google Drive</button>}
      <button onClick={logout} disabled={busy} style={{ width: '100%', marginTop: 4, padding: '9px 10px', border: 0, borderRadius: 6, textAlign: 'left', background: 'transparent', color: '#b42318', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>{busy ? 'Keluar…' : '↪  Keluar'}</button>
    </div>}
  </div>;
}
