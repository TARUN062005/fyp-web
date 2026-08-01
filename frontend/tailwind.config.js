/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        admin: {
          canvas: 'var(--admin-canvas)',
          panel: 'var(--admin-panel)',
          surface: 'var(--admin-surface)',
          ink: 'var(--admin-ink)',
          muted: 'var(--admin-muted)',
          line: 'var(--admin-line)',
          accent: 'var(--admin-accent)',
          'accent-soft': 'var(--admin-accent-soft)',
          danger: 'var(--admin-danger)',
          sidebar: 'var(--admin-sidebar)',
          'sidebar-ink': 'var(--admin-sidebar-ink)',
          'sidebar-muted': 'var(--admin-sidebar-muted)',
          'sidebar-active': 'var(--admin-sidebar-active)',
          severity: {
            low: 'var(--severity-low)',
            medium: 'var(--severity-medium)',
            high: 'var(--severity-high)',
            critical: 'var(--severity-critical)',
          },
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        admin: '0 1px 0 rgba(21, 32, 43, 0.06)',
      },
      backgroundImage: {
        'admin-canvas':
          'radial-gradient(1200px 600px at 0% 0%, color-mix(in srgb, var(--admin-accent) 10%, transparent), transparent 55%), linear-gradient(180deg, var(--admin-canvas) 0%, #edf1f5 100%)',
      },
    },
  },
  plugins: [],
};
