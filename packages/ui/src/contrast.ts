// WCAG 2.x contrast for oklch colours: the check behind principles.md's contrast rule.

type Rgb = [number, number, number];

// oklch → linear sRGB (Björn Ottosson's OKLab matrices). Out-of-gamut channels are clamped.
export function oklchToLinearRgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

export function parseOklch(value: string): Rgb {
  const m = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!m) throw new Error(`not an opaque oklch() colour: ${value}`);
  return oklchToLinearRgb(Number(m[1]), Number(m[2]), Number(m[3]));
}

const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(parseOklch(fg)), luminance(parseOklch(bg))].sort((x, y) => y - x) as [number, number];
  return (a + 0.05) / (b + 0.05);
}
