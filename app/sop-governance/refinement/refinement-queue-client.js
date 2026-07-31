'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const label = value => value?.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());

export default function RefinementQueueClient() {
  const router = useRouter(); const params = useSearchParams(); const query = params.toString();
  const [data, setData] = useState(null); const [failed, setFailed] = useState(false);
  const set = (key, value) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); next.delete('page'); router.replace(`?${next}`); };
  useEffect(() => { setData(null); setFailed(false); fetch(`/api/governance/refinement?${query}`).then(response => response.json()).then(result => { if (!result.ok) throw Error(); setData(result.data); }).catch(() => setFailed(true)); }, [query]);
  const items = data?.items || [];
  return <main className="native-page"><header><p className="eyebrow">Governance workspace</p><h1>Refinement Queue</h1><p>Prioritized SOP versions currently in human Refinement. Findings and reference editing arrive in the next controlled slice.</p></header><section className="repository-toolbar"><input placeholder="Search SOP" defaultValue={params.get('search') || ''} onChange={event => set('search', event.target.value)} /><select value={params.get('blockingOnly') || ''} onChange={event => set('blockingOnly', event.target.value)}><option value="">All work</option><option value="true">Blocking only</option></select><button onClick={() => router.replace('?')}>Clear filters</button></section><section className="repository-card"><table><thead><tr><th>SOP</th><th>Business Unit</th><th>Version</th><th>Blocking Findings</th><th>Status</th><th>Last Activity</th><th>Reviewer</th></tr></thead><tbody>{!data && !failed ? <tr><td colSpan="7">Loading Refinement queue…</td></tr> : failed ? <tr><td colSpan="7">Unable to load the Refinement queue. Try again.</td></tr> : items.length ? items.map(item => <tr key={item.versionId}><td>{item.sop}</td><td>{item.businessUnit.name}</td><td>{item.version}</td><td>{item.blockingFindings}</td><td><span className="status">{label(item.workStatus)}</span></td><td>{new Date(item.lastActivityAt).toLocaleDateString()}</td><td>{item.reviewer?.name || 'Unassigned'}</td></tr>) : <tr><td colSpan="7">No SOP version currently requires Refinement.</td></tr>}</tbody></table></section></main>;
}
