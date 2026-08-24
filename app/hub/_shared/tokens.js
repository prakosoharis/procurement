// Design tokens shared by every React hub page. Lifted from the approved
// static hub's :root block; --primary uses the hex approximation
// AccountMenu/AssistantPanel already established (#991b1b for hsl(0,72%,38%))
// so every React-shell element -- old and new -- reads as one consistent
// surface rather than several slightly different reds.
export const BG = '#f0f2f5';
export const CARD = '#fff';
export const FG = '#1a2236';
export const PRIMARY = '#991b1b';
export const PRIMARY_SOFT = 'rgba(153,27,27,0.08)';
export const MUTED = '#6b7280';
export const MUTED_BG = '#eff1f4';
export const BORDER = '#e2e5ea';
export const RADIUS = 10;

export const BADGE = {
  green: { background: '#dcfce7', color: '#15803d' },
  amber: { background: '#fef3c7', color: '#b45309' },
  red: { background: '#fee2e2', color: '#b91c1c' },
  blue: { background: '#dbeafe', color: '#1d4ed8' },
  muted: { background: MUTED_BG, color: MUTED }
};
