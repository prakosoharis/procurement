'use client';
import { useState } from 'react';
import HubHeader from '../_shared/hub-header';
import { BG, BORDER, FG, MUTED, PRIMARY } from '../_shared/tokens';
import SopTab from './sop-tab';
import SourcesTab from './sources-tab';
import LinksTab from './links-tab';
import TemplatesTab from './templates-tab';

const TABS = [['sop', 'SOP'], ['templates', 'Template'], ['sources', 'Sumber Pembanding'], ['links', 'Hubungan SOP & Sumber']];

export default function RepositoryPage({ role, viewerId }) {
  const [section, setSection] = useState('sop');
  const canManage = role === 'SUPER_USER' || role === 'CORPORATE_GOVERNANCE';

  return <div style={{ minHeight: '100vh', background: BG }}>
    <HubHeader active="repository" role={role} />
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700, color: FG }}>SOP Repository</h2><p style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>Kelola seluruh dokumen SOP dari semua Bisnis Unit</p></div>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setSection(key)} style={{
            padding: '10px 16px', border: 'none', borderBottom: `2px solid ${section === key ? PRIMARY : 'transparent'}`,
            background: 'transparent', color: section === key ? PRIMARY : MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>{label}</button>
        ))}
      </div>

      {section === 'sop' && <SopTab canManage={canManage} viewerId={viewerId} />}
      {section === 'templates' && <TemplatesTab />}
      {section === 'sources' && <SourcesTab />}
      {section === 'links' && <LinksTab />}
    </div>
  </div>;
}
