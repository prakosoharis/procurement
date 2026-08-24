import { BORDER } from '../_shared/tokens';

// Every app/api/people/* route wraps lib/api/governance.js: success is
// {ok:true, data, meta}, failure is {ok:false, error:{code, message}, meta}
// -- a different envelope from the rest of the app's plain-JSON API routes.
export async function peopleRequest(url, options) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload?.error?.message || 'Permintaan tidak dapat diproses.');
  return payload.data;
}

export const fieldStyle = { fontSize: 13, padding: '0 12px', height: 36, borderRadius: 8, border: `1px solid ${BORDER}`, width: '100%' };

export function tenureLabel(startDate) {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return '—';
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years && rest) return `${years} th ${rest} bln`;
  if (years) return `${years} th`;
  return `${rest} bln`;
}

export const fmtDate = (value) => value ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
