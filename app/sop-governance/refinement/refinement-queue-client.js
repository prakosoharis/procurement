'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const label = value => value?.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());

export default function RefinementQueueClient() {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.toString();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [announcement, setAnnouncement] = useState('Loading Refinement queue.');
  const set = (key, value) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    next.delete('page');
    router.replace(`?${next}`);
  };

  useEffect(() => {
    setData(null);
    setFailed(false);
    setAnnouncement('Loading Refinement queue.');
    fetch(`/api/governance/refinement?${query}`)
      .then(response => response.json())
      .then(result => {
        if (!result.ok) throw Error();
        setData(result.data);
        setAnnouncement(`${result.data?.items?.length || 0} SOP version(s) in the Refinement queue.`);
      })
      .catch(() => {
        setFailed(true);
        setAnnouncement('Unable to load the Refinement queue.');
      });
  }, [query]);

  const items = data?.items || [];
  return <main className="native-page">
    <header><p className="eyebrow">Governance workspace</p><h1>Refinement Queue</h1><p>Prioritized SOP versions currently in Human-Only Refinement.</p></header>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    <section className="repository-toolbar" aria-label="Refinement queue filters">
      <label>Search SOP<input aria-label="Search SOP" placeholder="Search SOP" defaultValue={params.get('search') || ''} onChange={event => set('search', event.target.value)} /></label>
      <label>Work status<select value={params.get('blockingOnly') || ''} onChange={event => set('blockingOnly', event.target.value)}><option value="">All work</option><option value="true">Blocking only</option></select></label>
      <button type="button" onClick={() => router.replace('?')}>Clear filters</button>
    </section>
    <section className="repository-card">
      <table>
        <caption className="sr-only">SOP versions in the Refinement queue</caption>
        <thead><tr><th scope="col">SOP</th><th scope="col">Business Unit</th><th scope="col">Version</th><th scope="col">Blocking Findings</th><th scope="col">Status</th><th scope="col">Last Activity</th><th scope="col">Reviewer</th></tr></thead>
        <tbody>
          {!data && !failed ? <tr><td colSpan="7">Loading Refinement queue…</td></tr> : null}
          {failed ? <tr><td colSpan="7" role="alert">Unable to load the Refinement queue. Try again.</td></tr> : null}
          {data && !failed && !items.length ? <tr><td colSpan="7">No SOP version currently requires Refinement.</td></tr> : null}
          {items.map(item => <tr key={item.versionId}><td><Link href={`/sop-governance/refinement/${item.versionId}`}>{item.sop}<span className="sr-only">, version {item.version}</span></Link></td><td>{item.businessUnit.name}</td><td>{item.version}</td><td>{item.blockingFindings}</td><td><span className="status">{label(item.workStatus)}</span></td><td>{new Date(item.lastActivityAt).toLocaleDateString()}</td><td>{item.reviewer?.name || 'Unassigned'}</td></tr>)}
        </tbody>
      </table>
    </section>
  </main>;
}
