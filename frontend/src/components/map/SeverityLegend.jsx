import { SEVERITY_LEVELS, SEVERITY_MARK } from '../../theme/severity.js';

const SeverityLegend = () => (
  <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] border border-admin-line bg-admin-panel/95 px-3 py-2 shadow-admin backdrop-blur">
    <p className="font-mono text-[10px] uppercase tracking-wider text-admin-muted">
      Severity
    </p>
    <ul className="mt-1.5 flex flex-col gap-1">
      {SEVERITY_LEVELS.map((level) => (
        <li
          key={level}
          className="flex items-center gap-2 text-xs text-admin-ink"
        >
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-sm font-mono text-[10px] font-semibold text-admin-surface"
            style={{
              backgroundColor: `var(--severity-${level.toLowerCase()})`,
            }}
            aria-hidden
          >
            {SEVERITY_MARK[level]}
          </span>
          {level}
        </li>
      ))}
    </ul>
  </div>
);

export default SeverityLegend;
