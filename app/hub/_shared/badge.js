import { BADGE } from './tokens';

export default function Badge({ tone = 'muted', children }) {
  const palette = BADGE[tone] || BADGE.muted;
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, ...palette }}>{children}</span>;
}
