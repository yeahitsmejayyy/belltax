// The concept palette: midnight navy, ivory, copper. Plain hex because these are print-and-favicon colours,
// not app tokens yet; if a concept goes forward its values move into tokens.css as oklch.
export const PALETTE = {
  navy: "#0b0a1f",
  navyRaised: "#16143a",
  ivory: "#f6f0e4",
  white: "#fbf8f2",
  copper: "#c08a5b", // ornaments and sublines on dark grounds
  copperLight: "#d9a878", // highlights on dark
  bronze: "#8a5a33", // copper's stand-in on light grounds (copper itself is ~2.6:1 on ivory)
  green: "#0f2a22",
  greenInk: "#123d30",
  oxblood: "#3d0d12",
} as const;

export type Tone = "dark" | "light";

// What each tone draws with. `ground` is the surface the concept is designed against.
export function inks(tone: Tone, ground: string = tone === "dark" ? PALETTE.navy : PALETTE.ivory) {
  return tone === "dark"
    ? { ground, letter: PALETTE.white, accent: PALETTE.copper, sub: PALETTE.copper, faint: PALETTE.copper }
    : { ground, letter: PALETTE.navy, accent: PALETTE.bronze, sub: PALETTE.bronze, faint: PALETTE.bronze };
}

// WCAG 2.x contrast between two #rrggbb colours (the story prints it under each subline).
export function hexContrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
