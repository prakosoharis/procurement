'use client';
import { useEffect, useMemo, useState } from 'react';
import Modal from '../_shared/modal';
import { BG, BORDER, CARD, FG, MUTED, PRIMARY } from '../_shared/tokens';
import { peopleRequest, fieldStyle, tenureLabel, fmtDate } from './people-api';

// Faithful React port of the static hub's org-structure tab. Zoom is a CSS
// transform:scale() on the tree, same as the original -- there is no
// drag-to-pan or charting library involved, only native scroll + a fit/reset
// button, so no new dependency is needed here.

function buildIndex(nodes) {
  const byParent = {};
  const byId = {};
  for (const node of nodes) {
    byId[node.id] = node;
    const key = node.parentId || 'root';
    (byParent[key] ||= []).push(node);
  }
  Object.values(byParent).forEach((list) => list.sort((a, b) => a.displayOrder - b.displayOrder));
  return { byParent, byId };
}

function descendantIds(index, id) {
  const result = new Set();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    for (const child of index.byParent[current] || []) {
      result.add(child.id);
      stack.push(child.id);
    }
  }
  return result;
}

function matchesQuery(node, query) {
  const haystack = [node.title, node.code, ...node.occupants.map((o) => o.fullName)].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query);
}

// Faithful port of the static hub's classic top-down org chart: rows of
// sibling boxes centered under a shared parent, connected by CSS
// pseudo-element lines (peopleNode()/lines 266-280 of the approved asset).
// React inline styles can't express :before/:after, so the connector rules
// live in the <style> block TreeStyles renders once per OrgChart mount.
// Non-matching nodes stay in the DOM with a hidden class (not removed via
// early return) because the connector CSS depends on :first-child/
// :last-child/:only-child selectors seeing every sibling.
function TreeStyles() {
  return <style>{`
    .people-tree, .people-tree ul { list-style: none; margin: 0; padding: 0; position: relative; }
    .people-tree { display: flex; justify-content: center; align-items: flex-start; min-width: max-content; }
    .people-tree ul { display: flex; justify-content: center; align-items: flex-start; width: max-content; padding-top: 30px; }
    .people-tree li { position: relative; display: flex; flex: 0 0 auto; flex-direction: column; align-items: center; width: max-content; text-align: center; padding: 30px 10px 0; }
    .people-tree > li { padding-top: 0; margin: 0; }
    .people-tree > li:before, .people-tree > li:after { display: none; }
    .people-tree li:before, .people-tree li:after { content: ''; position: absolute; top: 0; right: 50%; width: 50%; height: 30px; border-top: 1px solid #cbd5e1; }
    .people-tree li:after { right: auto; left: 50%; border-left: 1px solid #cbd5e1; }
    .people-tree li:only-child:after, .people-tree li:only-child:before { display: none; }
    .people-tree li:only-child { padding-top: 0; }
    .people-tree li:first-child:before, .people-tree li:last-child:after { border: 0 none; }
    .people-tree li:last-child:before { border-right: 1px solid #cbd5e1; border-radius: 0 7px 0 0; }
    .people-tree li:first-child:after { border-radius: 7px 0 0 0; }
    .people-tree > li > ul:before, .people-tree ul ul:before { content: ''; position: absolute; top: 0; left: 50%; height: 30px; border-left: 1px solid #cbd5e1; }
    .people-tree li.people-hidden { display: none; }
    .people-node { width: 238px; text-align: left; background: #fff; border: 1px solid #e2e5ea; border-radius: 10px; box-shadow: 0 2px 7px rgba(15,23,42,.06); overflow: hidden; cursor: pointer; }
    .people-node:hover { border-color: #f0aaaa; box-shadow: 0 5px 14px rgba(153,27,27,.12); }
    .people-node.is-match { border: 2px solid #991b1b; }
    .people-node.is-vacant .people-node-occupants { color: #a16207; }
    .people-node-head { padding: 11px 12px 8px; border-bottom: 1px solid #e2e5ea; }
    .people-node-title { font-size: 12px; font-weight: 700; line-height: 1.35; }
    .people-node-code { font-size: 10px; font-family: monospace; color: #6b7280; margin-top: 3px; }
    .people-node-occupants { padding: 10px 12px; font-size: 11px; line-height: 1.55; min-height: 43px; }
    .people-node-occupant { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .people-node-foot { padding: 7px 12px; background: #eff1f4; font-size: 10px; color: #6b7280; display: flex; justify-content: space-between; gap: 6px; }
    .people-collapse { border: 0; background: transparent; color: #991b1b; cursor: pointer; font-size: 11px; padding: 0; }
    .people-chart-viewport { min-height: 360px; max-height: 680px; overflow: auto; background-image: linear-gradient(90deg,rgba(148,163,184,.07) 1px,transparent 1px),linear-gradient(rgba(148,163,184,.07) 1px,transparent 1px); background-size: 20px 20px; padding: 26px; }
    .people-tree-stage { min-width: max-content; transform-origin: top left; padding: 8px 16px 30px; }
  `}</style>;
}

function PositionNode({ node, index, collapsed, forceExpanded, visibleIds, matchIds, onToggle, onOpen }) {
  const children = index.byParent[node.id] || [];
  const isCollapsed = collapsed.has(node.id) && !forceExpanded.has(node.id);
  const isMatch = matchIds?.has(node.id);
  const isHidden = visibleIds && !visibleIds.has(node.id);
  const vacant = !node.occupants.length;
  const shown = node.occupants.slice(0, 3);
  const extra = node.occupants.length - shown.length;

  return <li className={isHidden ? 'people-hidden' : ''}>
    <article
      className={`people-node${vacant ? ' is-vacant' : ''}${isMatch ? ' is-match' : ''}`}
      role="button" tabIndex={0}
      onClick={() => onOpen(node)}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(node); } }}
      aria-label={`Buka detail posisi ${node.title}${vacant ? ', posisi kosong' : ''}; ${node.occupants.length} personel aktif`}
    >
      <div className="people-node-head">
        <div className="people-node-title">{node.title}</div>
        <div className="people-node-code">{node.code || 'Tanpa kode'}</div>
      </div>
      <div className="people-node-occupants">
        {vacant ? <span>＋ Posisi kosong</span> : <>
          {shown.map((o) => <span key={o.assignmentId} className="people-node-occupant">● {o.fullName} · {tenureLabel(o.startDate)}</span>)}
          {extra > 0 && <span className="people-node-occupant">+ {extra} personel lainnya</span>}
        </>}
      </div>
      <div className="people-node-foot">
        {children.length
          ? <button type="button" className="people-collapse" onClick={(event) => { event.stopPropagation(); onToggle(node.id); }}>{isCollapsed ? `Tampilkan ${children.length} anak` : `Sembunyikan ${children.length} anak`}</button>
          : <span>0 anak</span>}
        <span>Detail ›</span>
      </div>
    </article>
    {children.length > 0 && !isCollapsed && <ul>
      {children.map((child) => <PositionNode key={child.id} node={child} index={index} collapsed={collapsed} forceExpanded={forceExpanded} visibleIds={visibleIds} matchIds={matchIds} onToggle={onToggle} onOpen={onOpen} />)}
    </ul>}
  </li>;
}

function CreateStructureForm({ onSubmit, busy }) {
  function submit(event) {
    event.preventDefault();
    const form = event.target;
    onSubmit({
      name: form.name.value.trim(), effectiveDate: form.effectiveDate.value || null,
      rootTitle: form.rootTitle.value.trim(), rootCode: form.rootCode.value.trim() || null, rootDescription: form.rootDescription.value.trim() || null
    });
  }
  return <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Nama struktur</label><input name="name" required placeholder="Contoh: Struktur Organisasi BKES" style={fieldStyle} /></div>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Tanggal berlaku <span style={{ color: MUTED, fontWeight: 400 }}>(opsional)</span></label><input name="effectiveDate" type="date" style={fieldStyle} /></div>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Jabatan puncak (root)</label><input name="rootTitle" required placeholder="Contoh: Kepala Business Unit" style={fieldStyle} /></div>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Kode jabatan <span style={{ color: MUTED, fontWeight: 400 }}>(opsional)</span></label><input name="rootCode" style={fieldStyle} /></div>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Deskripsi <span style={{ color: MUTED, fontWeight: 400 }}>(opsional)</span></label><textarea name="rootDescription" rows={3} style={{ ...fieldStyle, height: 'auto', padding: 8 }} /></div>
    <button type="submit" disabled={busy} style={{ alignSelf: 'flex-start', padding: '0 16px', height: 36, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>{busy ? 'Menyimpan…' : 'Buat Struktur'}</button>
  </form>;
}

function PositionForm({ initial, onSubmit, busy }) {
  function submit(event) {
    event.preventDefault();
    const form = event.target;
    onSubmit({ title: form.title.value.trim(), code: form.code.value.trim() || null, description: form.description.value.trim() || null });
  }
  return <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Nama jabatan</label><input name="title" required defaultValue={initial?.title || ''} style={fieldStyle} /></div>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Kode jabatan <span style={{ color: MUTED, fontWeight: 400 }}>(opsional)</span></label><input name="code" defaultValue={initial?.code || ''} style={fieldStyle} /></div>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Deskripsi <span style={{ color: MUTED, fontWeight: 400 }}>(opsional)</span></label><textarea name="description" rows={3} defaultValue={initial?.description || ''} style={{ ...fieldStyle, height: 'auto', padding: 8 }} /></div>
    <button type="submit" disabled={busy} style={{ alignSelf: 'flex-start', padding: '0 16px', height: 36, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
  </form>;
}

function MoveForm({ position, index, onSubmit, busy }) {
  const excluded = useMemo(() => new Set([position.id, ...descendantIds(index, position.id)]), [position.id, index]);
  const options = Object.values(index.byId).filter((node) => !excluded.has(node.id));
  function submit(event) {
    event.preventDefault();
    const form = event.target;
    onSubmit({ newParentId: form.newParentId.value, newOrder: Number(form.newOrder.value) || 0 });
  }
  return <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Pindah ke bawah jabatan</label>
      <select name="newParentId" required defaultValue={position.parentId || ''} style={fieldStyle}>
        {options.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}
      </select>
    </div>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Urutan</label><input name="newOrder" type="number" min={0} defaultValue={position.displayOrder} style={fieldStyle} /></div>
    <button type="submit" disabled={busy} style={{ alignSelf: 'flex-start', padding: '0 16px', height: 36, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>{busy ? 'Memindahkan…' : 'Pindahkan'}</button>
  </form>;
}

function AssignForm({ profiles, onSubmit, busy }) {
  function submit(event) {
    event.preventDefault();
    const form = event.target;
    onSubmit({ personId: form.personId.value, startDate: form.startDate.value, type: form.type.value, note: form.note.value.trim() || null });
  }
  return <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Personel</label>
      <select name="personId" required defaultValue="" style={fieldStyle}>
        <option value="" disabled>Pilih personel</option>
        {profiles.map((p) => <option key={p.id} value={p.id}>{p.fullName}{p.employeeIdentifier ? ` · ${p.employeeIdentifier}` : ''}</option>)}
      </select>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Mulai menjabat</label><input name="startDate" type="date" required style={fieldStyle} /></div>
      <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Tipe</label>
        <select name="type" defaultValue="PERMANENT" style={fieldStyle}><option value="PERMANENT">Tetap</option><option value="ACTING">Pelaksana Tugas</option></select>
      </div>
    </div>
    <div><label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Catatan <span style={{ color: MUTED, fontWeight: 400 }}>(opsional)</span></label><textarea name="note" rows={2} style={{ ...fieldStyle, height: 'auto', padding: 8 }} /></div>
    <button type="submit" disabled={busy} style={{ alignSelf: 'flex-start', padding: '0 16px', height: 36, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>{busy ? 'Menyimpan…' : 'Assign'}</button>
  </form>;
}

function PositionDetail({ node, index, structureId, capabilities, onChanged }) {
  const [mode, setMode] = useState('view');
  const [history, setHistory] = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode('view');
    peopleRequest(`/api/people/positions/${node.id}/history`).then((data) => setHistory(data.assignments)).catch(() => setHistory('error'));
  }, [node.id]);

  async function run(action) {
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  function openAssign() {
    setMode('assign');
    if (!profiles) peopleRequest('/api/people/profiles').then((data) => setProfiles(data.profiles)).catch(() => setProfiles([]));
  }

  if (mode === 'positionForm') return <PositionForm busy={busy} onSubmit={(body) => run(() => peopleRequest(`/api/people/positions/${node.id}`, { method: 'PATCH', body: JSON.stringify({ operation: 'update', ...body, expectedUpdatedAt: node.updatedAt }) }))} />;
  if (mode === 'addChild') return <PositionForm busy={busy} onSubmit={(body) => run(() => peopleRequest('/api/people/positions', { method: 'POST', body: JSON.stringify({ structureId, parentId: node.id, ...body }) }))} />;
  if (mode === 'move') return <MoveForm position={node} index={index} busy={busy} onSubmit={(body) => run(() => peopleRequest(`/api/people/positions/${node.id}`, { method: 'PATCH', body: JSON.stringify({ operation: 'move', ...body, expectedUpdatedAt: node.updatedAt }) }))} />;
  if (mode === 'assign') return profiles === null
    ? <p style={{ fontSize: 13, color: MUTED }}>Memuat personel…</p>
    : <AssignForm profiles={profiles} busy={busy} onSubmit={(body) => run(() => peopleRequest('/api/people/assignments', { method: 'POST', body: JSON.stringify({ positionId: node.id, expectedPositionUpdatedAt: node.updatedAt, ...body }) }))} />;

  const buttonStyle = { padding: '0 12px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: FG, fontSize: 12, fontWeight: 600, cursor: 'pointer' };

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    {node.description && <p style={{ fontSize: 13, color: MUTED }}>{node.description}</p>}

    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6 }}>PEJABAT AKTIF</div>
      {node.occupants.length ? node.occupants.map((o) => (
        <div key={o.assignmentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
          <div><b style={{ fontSize: 12.5 }}>{o.fullName}</b><div style={{ fontSize: 11, color: MUTED }}>{o.type === 'ACTING' ? 'Pelaksana Tugas' : 'Tetap'} · {tenureLabel(o.startDate)}</div></div>
          {capabilities.canManageAssignments && <button disabled={busy} onClick={() => {
            const endDate = window.prompt('Tanggal berakhir (YYYY-MM-DD):');
            if (!endDate) return;
            run(() => peopleRequest(`/api/people/assignments/${o.assignmentId}/end`, { method: 'POST', body: JSON.stringify({ endDate, expectedUpdatedAt: o.updatedAt }) }));
          }} style={{ ...buttonStyle, color: '#b91c1c' }}>Akhiri</button>}
        </div>
      )) : <div style={{ fontSize: 12, color: '#b45309' }}>Posisi ini vakan.</div>}
    </div>

    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6 }}>RIWAYAT PENEMPATAN</div>
      {history === null && <p style={{ fontSize: 12, color: MUTED }}>Memuat riwayat…</p>}
      {history === 'error' && <p style={{ fontSize: 12, color: MUTED }}>Riwayat belum dapat dimuat.</p>}
      {Array.isArray(history) && (history.filter((a) => a.endDate).slice(0, 5).length
        ? history.filter((a) => a.endDate).slice(0, 5).map((a) => <div key={a.id} style={{ fontSize: 12, padding: '5px 0', borderBottom: `1px solid ${BORDER}` }}>{a.person.fullName} <span style={{ color: MUTED }}>· {fmtDate(a.startDate)} – {fmtDate(a.endDate)}</span></div>)
        : <p style={{ fontSize: 12, color: MUTED }}>Belum ada riwayat penempatan yang berakhir.</p>)}
    </div>

    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
      {capabilities.canManageAssignments && <button onClick={openAssign} style={buttonStyle}>+ Assign Person</button>}
      {capabilities.canEditStructure && <>
        <button onClick={() => setMode('addChild')} style={buttonStyle}>+ Tambah Child</button>
        <button onClick={() => setMode('positionForm')} style={buttonStyle}>Edit Posisi</button>
        {node.parentId && <button onClick={() => setMode('move')} style={buttonStyle}>Pindah / Urutkan</button>}
        <button disabled={busy} onClick={() => { if (window.confirm(`Arsipkan jabatan "${node.title}"?`)) run(() => peopleRequest(`/api/people/positions/${node.id}`, { method: 'PATCH', body: JSON.stringify({ operation: 'archive', expectedUpdatedAt: node.updatedAt }) })); }} style={{ ...buttonStyle, color: '#b91c1c' }}>Arsipkan</button>
      </>}
    </div>
  </div>;
}

export default function OrgChart({ scopeType, scopeId, capabilities }) {
  const [structure, setStructure] = useState(undefined);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(new Set());
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(1);
  const [openNodeId, setOpenNodeId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  async function load() {
    setStructure(undefined);
    setError(null);
    try {
      const data = await peopleRequest(`/api/people/structure?scopeType=${scopeType}&scopeId=${encodeURIComponent(scopeId)}`);
      setStructure(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { setCollapsed(new Set()); setSearch(''); setOpenNodeId(null); load(); }, [scopeType, scopeId]);

  const index = useMemo(() => structure?.nodes ? buildIndex(structure.nodes) : null, [structure]);
  const root = index?.byParent.root?.[0];

  const query = search.trim().toLowerCase();
  const { visibleIds, matchIds, forceExpanded } = useMemo(() => {
    if (!index || !query) return { visibleIds: null, matchIds: null, forceExpanded: new Set() };
    const matches = new Set(structure.nodes.filter((n) => matchesQuery(n, query)).map((n) => n.id));
    const ancestors = new Set();
    for (const id of matches) {
      let current = index.byId[id];
      while (current?.parentId) { ancestors.add(current.parentId); current = index.byId[current.parentId]; }
    }
    return { visibleIds: new Set([...matches, ...ancestors]), matchIds: matches, forceExpanded: ancestors };
  }, [index, query, structure]);

  const openNode = openNodeId ? structure?.nodes.find((n) => n.id === openNodeId) : null;

  async function createStructure(body) {
    setCreating(true);
    try {
      await peopleRequest('/api/people/structures', { method: 'POST', body: JSON.stringify({ scopeType, [scopeType === 'GROUP' ? 'organizationGroupId' : 'businessUnitId']: scopeId, ...body }) });
      setCreateOpen(false);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (error) return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28, textAlign: 'center', color: '#b91c1c' }}>Struktur organisasi belum dapat dimuat. Silakan refresh halaman.</div>;
  if (structure === undefined) return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28, textAlign: 'center', color: MUTED }}>Memuat struktur organisasi…</div>;

  if (!structure.structure || !root) {
    return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
      <p style={{ fontSize: 13, color: MUTED }}>Belum ada struktur organisasi untuk cakupan ini.</p>
      {capabilities.canEditStructure && <button onClick={() => setCreateOpen(true)} style={{ marginTop: 14, padding: '0 16px', height: 36, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>＋ Buat Struktur</button>}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Buat Struktur Organisasi">
        <CreateStructureForm busy={creating} onSubmit={createStructure} />
      </Modal>
    </div>;
  }

  const occupied = structure.nodes.filter((n) => !n.vacancy).length;

  return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
    <TreeStyles />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, padding: '14px 16px 0' }}>
      {[['Total Posisi', structure.nodes.length], ['Posisi Terisi', occupied], ['Posisi Kosong', structure.nodes.length - occupied], ['Struktur Berlaku', structure.structure.name]].map(([label, value]) => (
        <div key={label} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, color: MUTED }}>{label}</div>
          <div style={{ fontSize: typeof value === 'number' ? 22 : 14, fontWeight: 700, marginTop: 4 }}>{value}</div>
        </div>
      ))}
    </div>

    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div><h3 style={{ fontSize: 15, fontWeight: 700 }}>Struktur Organisasi</h3><p style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>Klik posisi untuk melihat detail dan tindakan yang tersedia.</p></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari jabatan atau nama personel…" style={{ ...fieldStyle, maxWidth: 220 }} />
        <button onClick={() => setZoom((z) => Math.max(.55, Math.round((z - .1) * 100) / 100))} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer' }}>−</button>
        <span style={{ fontSize: 11, minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(1.45, Math.round((z + .1) * 100) / 100))} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer' }}>+</button>
        <button onClick={() => setZoom(1)} style={{ padding: '0 12px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer', fontSize: 12 }}>Pusatkan</button>
        {capabilities.canEditStructure && <button disabled title="Struktur aktif sudah memiliki root" style={{ padding: '0 12px', height: 32, borderRadius: 8, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'default', opacity: .5 }}>＋ Tambah Posisi</button>}
      </div>
    </div>

    <div className="people-chart-viewport">
      <div className="people-tree-stage" style={{ transform: `scale(${zoom})` }}>
        <ul className="people-tree">
          <PositionNode node={root} index={index} collapsed={collapsed} forceExpanded={forceExpanded} visibleIds={visibleIds} matchIds={matchIds}
            onToggle={(id) => setCollapsed((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; })}
            onOpen={(node) => setOpenNodeId(node.id)} />
        </ul>
      </div>
    </div>

    <Modal open={!!openNode} onClose={() => setOpenNodeId(null)} title={openNode?.title} subtitle={openNode?.code} width={560}>
      {openNode && <PositionDetail node={openNode} index={index} structureId={structure.structure.id} capabilities={capabilities} onChanged={() => { setOpenNodeId(null); load(); }} />}
    </Modal>
  </div>;
}
