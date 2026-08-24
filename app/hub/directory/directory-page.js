'use client';
import { useEffect, useState } from 'react';
import Badge from '../_shared/badge';
import HubHeader from '../_shared/hub-header';
import Modal from '../_shared/modal';
import { BG, BORDER, CARD, FG, MUTED, PRIMARY } from '../_shared/tokens';

// Faithful React port of the static hub's Directory page (loadPics() /
// renderDirectory()): Super User sees every managed account (GET
// /api/users), every other role sees the Business Unit PIC contact list
// scoped to what GET /api/pics already returns for their role. The search
// input has no filtering wired in the original static markup either -- it
// is ported as-is rather than fixed in a page-conversion pass.

const ROLE_LABEL = { SUPER_USER: 'Super User', CORPORATE_GOVERNANCE: 'Corporate Governance', BUSINESS_UNIT_PIC: 'Business Unit PIC' };
const fieldStyle = { fontSize: 13, padding: '0 12px', height: 36, borderRadius: 8, border: `1px solid ${BORDER}`, width: '100%' };

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Permintaan gagal.');
  return payload;
}

function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function DirectoryCard({ entry }) {
  return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: 'flex', gap: 12 }}>
    <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(153,27,27,.1)', color: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{initials(entry.name)}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: FG }}>{entry.name}</div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{entry.jobTitle || ROLE_LABEL[entry.role] || 'User'}</div>
      <div style={{ marginTop: 6 }}><Badge>{(ROLE_LABEL[entry.role] || 'Business Unit PIC') + (entry.businessUnit?.name ? ` · ${entry.businessUnit.name}` : '')}</Badge></div>
      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
        📧 {entry.email}
        {entry.phone && <><br />📱 {entry.phone}</>}
      </div>
    </div>
  </div>;
}

function CreateUserForm({ businessUnits, onCreate, busy }) {
  const [role, setRole] = useState('CORPORATE_GOVERNANCE');
  const isBu = role === 'BUSINESS_UNIT_PIC';

  function submit(event) {
    event.preventDefault();
    const form = event.target;
    onCreate({
      name: form.name.value.trim(), email: form.email.value.trim(), phone: form.phone.value.trim(),
      jobTitle: form.jobTitle.value.trim(), locale: form.locale.value,
      businessUnitId: isBu ? form.businessUnitId.value : null, password: form.password.value, role
    });
  }

  return <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Nama lengkap</label><input name="name" required placeholder="Nama user" style={fieldStyle} /></div>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Role</label>
      <select value={role} onChange={(event) => setRole(event.target.value)} style={fieldStyle}>
        <option value="CORPORATE_GOVERNANCE">Corporate Governance</option>
        <option value="BUSINESS_UNIT_PIC">Business Unit PIC</option>
        <option value="SUPER_USER">Super User</option>
      </select>
    </div>
    {isBu && <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Business Unit</label>
      <select name="businessUnitId" required={isBu} style={fieldStyle} defaultValue="">
        <option value="" disabled>Pilih Business Unit</option>
        {businessUnits.map((bu) => <option key={bu.id} value={bu.id}>{bu.name} · {bu.groupName}</option>)}
      </select>
    </div>}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Email</label><input name="email" type="email" required placeholder="nama@company.com" style={fieldStyle} /></div>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Nomor telepon</label><input name="phone" required placeholder="+62..." style={fieldStyle} /></div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Jabatan / role kerja</label><input name="jobTitle" required placeholder="PIC Procurement" style={fieldStyle} /></div>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Bahasa</label>
        <select name="locale" defaultValue="id" style={fieldStyle}>
          <option value="id">Bahasa Indonesia</option><option value="en">English</option>
        </select>
      </div>
    </div>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Password awal</label><input name="password" type="password" minLength={8} required placeholder="Minimal 8 karakter" style={fieldStyle} /></div>
    <button type="submit" disabled={busy} style={{ alignSelf: 'flex-start', padding: '0 16px', height: 36, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>
      {busy ? 'Menyimpan…' : 'Simpan User'}
    </button>
  </form>;
}

function UserAccessModal({ open, onClose }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setUsers(null);
    setError(null);
    fetch('/api/users').then(readJson).then(setUsers).catch((err) => setError(err.message));
  }, [open]);

  async function reset(id, name) {
    const password = window.prompt(`Masukkan password baru untuk ${name} (minimal 8 karakter):`);
    if (password === null) return;
    if (password.length < 8) { alert('Password minimal 8 karakter.'); return; }
    try {
      const result = await fetch(`/api/users/${id}/password`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }).then(readJson);
      alert(`Password ${result.name} berhasil diubah.`);
    } catch (err) {
      alert(err.message);
    }
  }

  return <Modal open={open} onClose={onClose} title="Kelola Akses User" subtitle="Admin dapat mengatur ulang password akun Compliance, Corporate Procurement, dan PIC Business Unit." width={640}>
    <div style={{ maxHeight: 420, overflow: 'auto' }}>
      {error && <p style={{ padding: 20, textAlign: 'center', color: '#b91c1c' }}>{error}</p>}
      {!error && users === null && <p style={{ padding: 20, textAlign: 'center', color: MUTED }}>Memuat user...</p>}
      {!error && users?.length === 0 && <p style={{ padding: 20, textAlign: 'center', color: MUTED }}>Belum ada user yang dapat dikelola.</p>}
      {users?.map((user) => (
        <div key={user.id} style={{ padding: '12px 2px', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
              {ROLE_LABEL[user.role] || user.role}{user.businessUnit?.name ? ` · ${user.businessUnit.name}` : ''}<br />{user.email}
            </div>
          </div>
          <button onClick={() => reset(user.id, user.name)} style={{ padding: '0 12px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Reset password</button>
        </div>
      ))}
    </div>
  </Modal>;
}

export default function DirectoryPage({ role }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const isSuperUser = role === 'SUPER_USER';

  async function load() {
    try {
      const data = await fetch(isSuperUser ? '/api/users' : '/api/pics').then(readJson);
      setEntries(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [isSuperUser]);
  useEffect(() => {
    if (isSuperUser) fetch('/api/business-units').then(readJson).then(setBusinessUnits).catch(() => {});
  }, [isSuperUser]);

  async function createUser(body) {
    setCreating(true);
    try {
      const result = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(readJson);
      setCreateOpen(false);
      await load();
      alert(`User ${result.name} berhasil ditambahkan.`);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader active="directory" role={role} />
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700 }}>Directory</h2><p style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>Manajemen user dan kontak Business Unit.</p></div>
        {isSuperUser && <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setAccessOpen(true)} style={{ padding: '0 14px', height: 34, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>⚿ Kelola Akses</button>
          <button onClick={() => setCreateOpen(true)} style={{ padding: '0 14px', height: 34, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>+ Tambah User</button>
        </div>}
      </div>

      <div style={{ maxWidth: 360, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: MUTED, fontSize: 13 }}>🔍</span>
        <input type="text" placeholder="Cari nama atau BU..." style={{ ...fieldStyle, paddingLeft: 36 }} />
      </div>

      {error && <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, textAlign: 'center', color: '#b91c1c' }}>Directory belum dapat dimuat. Silakan refresh halaman.</div>}
      {!error && entries === null && <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, textAlign: 'center', color: MUTED }}>Memuat directory...</div>}
      {!error && entries?.length === 0 && <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, textAlign: 'center', color: MUTED }}>Belum ada user.</div>}
      {entries?.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {entries.map((entry) => <DirectoryCard key={entry.id} entry={entry} />)}
      </div>}
    </div>

    {isSuperUser && <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tambah User" subtitle="Super User dapat membuat akun Corporate Governance, Business Unit PIC, atau Super User.">
      <CreateUserForm businessUnits={businessUnits} onCreate={createUser} busy={creating} />
    </Modal>}
    {isSuperUser && <UserAccessModal open={accessOpen} onClose={() => setAccessOpen(false)} />}
  </div>;
}
