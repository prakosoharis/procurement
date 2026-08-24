import { BORDER, CARD, MUTED } from './tokens';

export const engagementTone = (score) => (score >= 80 ? '#15803d' : score >= 60 ? '#b45309' : '#b91c1c');

export default function EngagementComponent({ label, health, description }) {
  const status = health >= 80 ? 'BAIK' : health >= 60 ? 'PERLU DIPANTAU' : 'PERLU TINDAKAN';
  return <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, background: CARD }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <b style={{ fontSize: 12 }}>{label}</b>
      <b style={{ fontSize: 10, color: engagementTone(health) }}>{status}</b>
    </div>
    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{description}</div>
    <div style={{ height: 6, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden', marginTop: 7 }}>
      <div style={{ height: '100%', width: `${health}%`, background: engagementTone(health) }} />
    </div>
  </div>;
}
