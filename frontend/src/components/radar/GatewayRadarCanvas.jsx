import { useMemo } from 'react';

/**
 * 2D polar radar from the gateway's visual sector (not compass, not GPS).
 * Android currently uses ±60° forward FOV; elevation is not transmitted.
 */
const GatewayRadarCanvas = ({
  peers = [],
  radarRangeMeters = 20,
  selectedPeerId,
  onSelectPeer,
  stale = false,
}) => {
  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 170;
  const range = Number(radarRangeMeters) > 0 ? Number(radarRangeMeters) : 20;

  const rings = [0.25, 0.5, 0.75, 1];

  const plotted = useMemo(
    () =>
      (peers || []).map((peer) => {
        const dist = Number(peer.distanceMeters);
        const angle = Number(peer.angleDegrees);
        const displayDist = Number.isFinite(dist)
          ? Math.min(dist, range)
          : range;
        const rad = ((Number.isFinite(angle) ? angle : 0) * Math.PI) / 180;
        const r = (displayDist / range) * maxR;
        return {
          ...peer,
          x: cx + r * Math.sin(rad),
          y: cy - r * Math.cos(rad),
        };
      }),
    [peers, range, cx, cy, maxR]
  );

  const fovLeft = ((-60) * Math.PI) / 180;
  const fovRight = (60 * Math.PI) / 180;
  const arc = (a) => `${cx + maxR * Math.sin(a)} ${cy - maxR * Math.cos(a)}`;
  const fovPath = `M ${cx} ${cy} L ${arc(fovLeft)} A ${maxR} ${maxR} 0 0 1 ${arc(
    fovRight
  )} Z`;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={`h-auto w-full max-w-xl ${stale ? 'opacity-60' : ''}`}
      role="img"
      aria-label="Gateway radar"
    >
      <rect width={size} height={size} fill="#0f1720" />
      <path d={fovPath} fill="#134e4a" fillOpacity="0.25" />
      {rings.map((f) => (
        <circle
          key={f}
          cx={cx}
          cy={cy}
          r={maxR * f}
          fill="none"
          stroke="#334155"
          strokeWidth="1"
        />
      ))}
      <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="#1e293b" />
      <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="#1e293b" />
      <polygon
        points={`${cx},${cy - 12} ${cx - 8},${cy + 8} ${cx + 8},${cy + 8}`}
        fill="#ccfbf1"
      />
      <text
        x={cx}
        y={cy + 28}
        textAnchor="middle"
        fill="#99f6e4"
        fontSize="10"
        fontFamily="IBM Plex Mono, monospace"
      >
        GATEWAY
      </text>
      {plotted.map((peer) => {
        const selected = peer.peerId === selectedPeerId;
        return (
          <g
            key={peer.peerId}
            className="cursor-pointer"
            onClick={() => onSelectPeer?.(peer)}
          >
            <circle
              cx={peer.x}
              cy={peer.y}
              r={selected ? 8 : 6}
              fill={selected ? '#ccfbf1' : '#5eead4'}
              stroke={selected ? '#f8fafc' : '#0f766e'}
              strokeWidth="1.5"
            />
            <text
              x={peer.x}
              y={peer.y - 12}
              textAnchor="middle"
              fill="#e2e8f0"
              fontSize="10"
              fontFamily="IBM Plex Sans, sans-serif"
            >
              {peer.displayName}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default GatewayRadarCanvas;
