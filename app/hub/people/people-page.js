'use client';
import { useEffect, useState } from 'react';
import HubHeader from '../_shared/hub-header';
import { BG, BORDER, CARD, FG, MUTED, PRIMARY } from '../_shared/tokens';
import { peopleRequest, fieldStyle } from './people-api';
import OrgChart from './org-chart';
import ProfilesTab from './profiles-tab';

// Faithful React port of the static hub's People page: a scope selector
// (which Business Unit or, for actors with cross-BU access, Organization
// Group to view), an access banner, and two tabs -- org structure chart and
// personnel profiles -- both backed by the real app/api/people/* endpoints.

export default function PeoplePage({ role }) {
  const [options, setOptions] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('structure');
  const [scopeType, setScopeType] = useState('BUSINESS_UNIT');
  const [scopeId, setScopeId] = useState('');

  useEffect(() => {
    peopleRequest('/api/people/options').then((data) => {
      setOptions(data);
      const initial = data.defaultScope || (data.defaultBusinessUnitId ? { type: 'BUSINESS_UNIT', id: data.defaultBusinessUnitId } : null);
      if (initial) { setScopeType(initial.type); setScopeId(initial.id); }
    }).catch((err) => setError(err.message));
  }, []);

  if (error) return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader active="people" role={role} />
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24 }}>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28, textAlign: 'center', color: '#b91c1c' }}>People belum dapat dimuat. Silakan refresh halaman.</div>
    </div>
  </div>;

  if (!options) return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader active="people" role={role} />
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24 }}>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28, textAlign: 'center', color: MUTED }}>Memuat akses People...</div>
    </div>
  </div>;

  const items = scopeType === 'GROUP' ? options.organizationGroups : options.businessUnits;
  const hasGroups = options.organizationGroups.length > 0;
  const capabilities = options.capabilities;

  return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader active="people" role={role} />
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700 }}>People</h2><p style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>Struktur organisasi dan profil personel berdasarkan Business Unit.</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasGroups && <select value={scopeType} onChange={(event) => { const type = event.target.value; setScopeType(type); setScopeId((type === 'GROUP' ? options.organizationGroups : options.businessUnits)[0]?.id || ''); }} style={{ ...fieldStyle, width: 140 }}>
            <option value="BUSINESS_UNIT">Business Unit</option>
            <option value="GROUP">Group</option>
          </select>}
          <select value={scopeId} onChange={(event) => setScopeId(event.target.value)} style={{ ...fieldStyle, width: 220 }}>
            {items.map((item) => <option key={item.id} value={item.id}>{item.name}{item.industry ? ` · ${item.industry}` : ''}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 12.5, background: capabilities.canEditStructure ? 'rgba(153,27,27,.06)' : '#eff1f4', color: capabilities.canEditStructure ? PRIMARY : MUTED, border: `1px solid ${capabilities.canEditStructure ? 'rgba(153,27,27,.2)' : BORDER}` }}>
        {capabilities.canEditStructure ? 'Anda dapat membuat dan mengelola struktur organisasi, jabatan, dan penempatan personel.' : 'Mode lihat saja. Perubahan struktur dan profil dikelola oleh Corporate Governance.'}
      </div>

      <div role="tablist" aria-label="People" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${BORDER}` }}>
        {[['structure', 'Struktur Organisasi'], ['profiles', 'Profil Personel']].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} style={{
            padding: '10px 16px', border: 'none', borderBottom: `2px solid ${tab === key ? PRIMARY : 'transparent'}`,
            background: 'transparent', color: tab === key ? PRIMARY : MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>{label}</button>
        ))}
      </div>

      {scopeId && (tab === 'structure'
        ? <OrgChart scopeType={scopeType} scopeId={scopeId} capabilities={capabilities} />
        : <ProfilesTab capabilities={capabilities} />)}
    </div>
  </div>;
}
