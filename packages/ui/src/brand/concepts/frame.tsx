import * as React from "react";

import type { Tone } from "./palette";

// What every concept component takes. Lockups and marks both draw on a transparent canvas in the colours of
// `tone` (dark = designed for the navy ground, light = for ivory/white); the story supplies the ground.
export type ConceptProps = { className?: string; title?: string; tone?: Tone };
// Marks also take `small` (the 32px-and-under cut: thin copper detail dropped, strokes fattened) and `tile`
// (the app-icon / favicon version: the mark on its own rounded square of ground colour).
export type MarkProps = ConceptProps & { small?: boolean; tile?: boolean };

export type Concept = {
  id: string;
  name: string;
  fonts: string;
  intent: string;
  risk: string;
  Lockup: (p: ConceptProps) => React.ReactElement;
  Mark: (p: MarkProps) => React.ReactElement;
  // Ground colours the concept is shown on (dark hero, light hero).
  grounds: { dark: string; light: string };
};

// An accessible inline SVG: role="img" named by its <title>.
export function Svg({ viewBox, title, className, children }: { viewBox: string; title: string; className?: string; children: React.ReactNode }) {
  const id = `t${React.useId().replace(/:/g, "")}`;
  return (
    <svg viewBox={viewBox} role="img" aria-labelledby={id} className={className} xmlns="http://www.w3.org/2000/svg">
      <title id={id}>{title}</title>
      {children}
    </svg>
  );
}

// The reference's signature: white lettering sitting on a solid copper extrusion, down and to the right.
// `children` must draw with inherited fill. Steps are 0.5 units apart so the extrusion reads as one solid.
export function Extrude({ depth, color, face, children, angle = 1 }: { depth: number; color: string; face: string; children: React.ReactNode; angle?: number }) {
  const steps = Math.max(1, Math.round(depth * 2));
  return (
    <g>
      {Array.from({ length: steps }, (_, i) => {
        const o = depth - (i * depth) / steps;
        return (
          <g key={i} fill={color} style={{ color }} transform={`translate(${o * angle} ${o})`}>
            {children}
          </g>
        );
      })}
      <g fill={face} style={{ color: face }}>{children}</g>
    </g>
  );
}

// The rounded-square app-icon ground (64-unit canvas, iOS-ish 22% corner).
export function Tile({ fill }: { fill: string }) {
  return <rect x="0" y="0" width="64" height="64" rx="14" fill={fill} />;
}
