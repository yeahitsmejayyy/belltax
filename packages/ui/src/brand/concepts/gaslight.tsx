import type { Concept, ConceptProps, MarkProps } from "./frame";
import { Extrude, Svg, Tile } from "./frame";
import { GLYPHS } from "./glyphs";
import { DottedRule, Filigree } from "./ornaments";
import { PALETTE, inks } from "./palette";

// 01 · Gaslight — the closest to the reference: a heavy italic B with a hand-drawn swash entry, white on a solid
// copper extrusion, a tail that underlines the word, scrolls above and below, a dotted rule, spaced caps.

const B = GLYPHS.playfair900Italic;

// The entry swash, in the glyph's own 100-unit space: three strokes that thin as they curl, ending in a ball.
function Swash() {
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M37 2.2C22 -1 6 3 -6 14" strokeWidth="7" />
      <path d="M-6 14C-17 24 -21 40 -14 49" strokeWidth="4.4" />
      <path d="M-14 49C-8 57 3 54 3 46.5C3 41 -2.5 39.5 -5.5 42" strokeWidth="2.4" />
      <circle cx="-6" cy="42.6" r="3.4" fill="currentColor" stroke="none" />
    </g>
  );
}

// The swash B as one inheriting-fill group (the swash strokes use currentColor, so set `color` too).
function SwashB({ swash = true }: { swash?: boolean }) {
  return (
    <g>
      <path d={B.d} />
      {swash ? <Swash /> : null}
    </g>
  );
}

export function GaslightLockup({ className, title = "Bell Tax Prep", tone = "dark" }: ConceptProps) {
  const ink = inks(tone);
  const s = 1.5;
  const bx = 128;
  const top = 66;
  const base = top + 100 * s;
  return (
    <Svg viewBox="0 0 640 340" title={title} className={className}>
      <Filigree color={ink.accent} transform="translate(320 28) scale(1.3)" />
      <Extrude depth={4.5} color={PALETTE.copper} face={ink.letter}>
        <g transform={`translate(${bx} ${top}) scale(${s})`}>
          <SwashB />
        </g>
        <text x={bx + 150} y={base} fontFamily="'Playfair Display', serif" fontStyle="italic" fontWeight={900} fontSize={212}>
          ell
        </text>
        {/* the tail: out of the B's foot, under the word, curling up at the end */}
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          <path d={`M${bx + 30} ${base + 2}C${bx + 80} ${base + 22} ${bx + 170} ${base + 24} ${bx + 250} ${base + 17}`} strokeWidth="6" />
          <path d={`M${bx + 250} ${base + 17}C${bx + 300} ${base + 13} ${bx + 345} ${base + 11} ${bx + 372} ${base + 13}`} strokeWidth="3.4" />
          <path d={`M${bx + 372} ${base + 13}C${bx + 392} ${base + 15} ${bx + 396} ${base + 30} ${bx + 384} ${base + 31}C${bx + 376} ${base + 32} ${bx + 374} ${base + 24} ${bx + 380} ${base + 23}`} strokeWidth="1.8" />
        </g>
      </Extrude>
      <DottedRule color={ink.accent} width={220} y={258} gap={7} r={1.1} x={320} />
      <text x={327} y={296} textAnchor="middle" fontFamily="Oswald, sans-serif" fontWeight={500} fontSize={26} letterSpacing={14} fill={ink.sub}>
        TAX PREP
      </text>
      <Filigree color={ink.accent} flip transform="translate(320 318) scale(0.9)" />
    </Svg>
  );
}

export function GaslightMark({ className, title = "Bell Tax Prep", tone = "dark", small = false, tile = false }: MarkProps) {
  const ink = inks(tone);
  // Small: no swash, a bigger letter and a shallower extrusion so the counters stay open at 16px.
  const s = small ? 0.5 : 0.42;
  const x = small ? (64 - B.w * s) / 2 - 1 : 14.6;
  const y = small ? 6.5 : 10;
  return (
    <Svg viewBox="0 0 64 64" title={title} className={className}>
      {tile ? <Tile fill={ink.ground} /> : null}
              <Extrude depth={small ? 2.5 : 2.2} color={PALETTE.copper} face={ink.letter}>
          <g transform={`translate(${x} ${y}) scale(${s})`}>
            <SwashB swash={!small} />
          </g>
        </Extrude>
    </Svg>
  );
}

export const gaslight: Concept = {
  id: "gaslight",
  name: "Gaslight",
  fonts: "Playfair Display 900 Italic (B outlined, 'ell' set), Oswald 500 subline",
  intent:
    "The reference's mood, made ours: a heavy italic B with a hand-drawn swash, white on a solid copper extrusion, a tail that underlines the name, scrolls above and below, a dotted rule and spaced caps.",
  risk: "The swash and tail only work big: below 32px the mark drops them. Italic B + extrusion leans busy next to product UI; it's a sign, not a button.",
  Lockup: GaslightLockup,
  Mark: GaslightMark,
  grounds: { dark: PALETTE.navy, light: PALETTE.ivory },
};
