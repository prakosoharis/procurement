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

function PositionNode({ node, index, collapsed, forceExpanded, visibleIds, matchIds, onToggle, onOpen }) {
  if (visibleIds && !visibleIds.has(node.id)) return null;
  const children = index.byParent[node.id] || [];
  const isCollapsed = collapsed.has(node.id) && !forceExpanded.has(node.id);
  const isMatch = matchIds?.has(node.id);
  const vacant = !node.occupants.length;
  const shown = node.occupants.slice(0, 3);
  const extra = node.occupants.length - shown.length;

  return <li style={{ listStyle: 'none' }}>
    <div onClick={() => onOpen(node)} style={{
      cursor: 'pointer', display: 'inline-block', minWidth: 190, padding: 10, borderRadius: 10,
      border: `1px solid ${isMatch ? PRIMARY : BORDER}`, background: vacant ? '#fef9f4' : CARD, marginBottom: 10
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <b style={{ fontSize: 12.5, color: FG }}>{node.title}</b>
        {children.length > 0 && <button onClick={(event) => { event.stopPropagation(); onToggle(node.id); }} aria-label={isCollapsed ? 'Perluas' : 'Ciutkan'} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 11, color: MUTED, flexShrink: 0 }}>{isCollapsed ? '▸' : '▾'}</button>}
      </div>
      {node.code && <div style={{ fontSize: 10.5, color: MUTED, marginTop: 1 }}>{node.code}</div>}
      {vacant
        ? <div style={{ fontSize: 11, color: '#b45309', marginTop: 5, fontWeight: 600 }}>Vakan</div>
        : shown.map((o) => <div key={o.assignmentId} style={{ fontSize: 11, marginTop: 5 }}>{o.fullName} <span style={{ color: MUTED }}>· {tenureLabel(o.startDate)}</span></div>)}
      {extra > 0 && <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3 }}>+{extra} lainnya</div>}
    </div>
    {children.length > 0 && !isCollapsed && <ul style={{ paddingLeft: 26, marginTop: -4, borderLeft: `1px solid ${BORDER}` }}>
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

  return <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18 }}>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari jabatan atau nama personel…" style={{ ...fieldStyle, maxWidth: 280 }} />
      <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
        <button onClick={() => setZoom((z) => Math.max(.55, Math.round((z - .1) * 100) / 100))} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer' }}>−</button>
        <button onClick={() => setZoom(1)} style={{ padding: '0 10px', height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer', fontSize: 12 }}>{Math.round(zoom * 100)}%</button>
        <button onClick={() => setZoom((z) => Math.min(1.45, Math.round((z + .1) * 100) / 100))} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer' }}>+</button>
      </div>
    </div>
    <div style={{ overflow: 'auto', padding: 8 }}>
      <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 'fit-content' }}>
        <ul style={{ padding: 0, margin: 0 }}>
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
