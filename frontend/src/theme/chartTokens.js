/** Read CSS custom properties for Recharts (cannot use Tailwind classes). */
const readVar = (name, fallback) => {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
};

export const getChartTokens = () => ({
  panel: readVar('--admin-panel', '#F4F7FA'),
  line: readVar('--admin-line', '#C9D4DE'),
  muted: readVar('--admin-muted', '#5B6B7C'),
  ink: readVar('--admin-ink', '#15202B'),
  accent: readVar('--admin-accent', '#0F766E'),
  high: readVar('--severity-high', '#D94801'),
});
