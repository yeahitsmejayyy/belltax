// Thin copper line work shared by the concepts: an original symmetric scroll (filigree), a dotted rule and a
// lozenge. Drawn as strokes in their own unit space; callers place them with a transform.

// One half of the scroll, from the centre (0, 0) out to x = 120. Mirrored for the other half.
const SCROLL_HALF = [
  // main stem sweeping up into an inward curl
  "M7 0C26 0 35 -9 51 -9C65 -9 72 -2.5 72 4.5C72 9.5 68 12.5 64 12.5C60.2 12.5 58.4 9.6 59.8 7.2",
  // upper frond with a small hook
  "M35 -4.2C39.5 -13 49 -17.4 59 -16.2C63.6 -15.6 65.4 -12.2 62.8 -10.8",
  // lower frond
  "M23 1C31 6.2 39 8.6 46 7.6",
  // long tapering tail out of the curl
  "M72 2.6C85 -2.2 98 -2.8 118 0",
];

export function Filigree({ color, stroke = 1.1, flip = false, transform }: { color: string; stroke?: number; flip?: boolean; transform?: string }) {
  const half = (
    <g>
      {SCROLL_HALF.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth={i === 3 ? stroke * 0.8 : stroke} strokeLinecap="round" />
      ))}
      <circle cx="86" cy="6.4" r={stroke * 1.15} fill={color} />
      <circle cx="122.5" cy="0" r={stroke * 1.3} fill={color} />
    </g>
  );
  return (
    <g transform={transform}>
      <g transform={flip ? "scale(1 -1)" : undefined}>
        {half}
        <g transform="scale(-1 1)">{half}</g>
        <path d="M0 -5.2L4.2 0L0 5.2L-4.2 0Z" fill={color} />
      </g>
    </g>
  );
}

// A centred row of dots `width` wide.
export function DottedRule({ color, width, gap = 6, r = 0.9, x = 0, y = 0 }: { color: string; width: number; gap?: number; r?: number; x?: number; y?: number }) {
  const n = Math.floor(width / gap);
  const start = x - (n * gap) / 2;
  return (
    <g fill={color}>
      {Array.from({ length: n + 1 }, (_, i) => (
        <circle key={i} cx={start + i * gap} cy={y} r={r} />
      ))}
    </g>
  );
}

export function Lozenge({ color, x, y, size = 4 }: { color: string; x: number; y: number; size?: number }) {
  return <path d={`M${x} ${y - size}L${x + size * 0.75} ${y}L${x} ${y + size}L${x - size * 0.75} ${y}Z`} fill={color} />;
}
