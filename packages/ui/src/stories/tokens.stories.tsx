import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { contrast } from "../contrast";

// The tokens as they render, with each pair's measured contrast (principles.md rule 5).

const meta: Meta = { parameters: { fill: true }, title: "Tokens" };
export default meta;

const PAIRS: [string, string, string][] = [
  ["Page", "foreground", "background"],
  ["Card", "card-foreground", "card"],
  ["Muted text", "muted-foreground", "background"],
  ["Primary button", "primary-foreground", "primary"],
  ["Brand chip", "brand-subtle-foreground", "brand-subtle"],
  ["Success chip", "success-foreground", "success-subtle"],
  ["Warning chip", "warning-foreground", "warning-subtle"],
  ["Danger chip", "danger-foreground", "danger-subtle"],
  ["Info chip", "info-foreground", "info-subtle"],
  ["Demo badge", "mode-demo-fg", "mode-demo-bg"],
  ["Sidebar", "sidebar-foreground", "sidebar"],
];

function useVars(names: string[]) {
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      setVals(Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])));
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [names.join()]);
  return vals;
}

const ratio = (fg?: string, bg?: string) => {
  try {
    // getComputedStyle normalises "oklch(0.985 0 0)" to "oklch(.985 0 0)"; contrast() expects digits first.
    const fix = (v: string) => v.replace(/\(\./, "(0.").replace(/ \./g, " 0.");
    return fg && bg ? contrast(fix(fg), fix(bg)) : NaN;
  } catch {
    return NaN;
  }
};

export const Colour: StoryObj = {
  render: () => {
    const vals = useVars(PAIRS.flatMap(([, a, b]) => [a, b]));
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PAIRS.map(([name, fg, bg]) => {
          const r = ratio(vals[fg], vals[bg]);
          return (
            <div key={name} className="overflow-hidden rounded-lg border">
              <div className="flex h-20 items-center justify-center text-sm font-medium" style={{ background: `var(--${bg})`, color: `var(--${fg})` }}>
                {name}
              </div>
              <div className="flex justify-between gap-2 px-3 py-2 font-mono text-xs text-muted-foreground">
                <span>--{fg} / --{bg}</span>
                <span className={r >= 4.5 ? "text-success-foreground" : "text-danger-foreground"}>{Number.isFinite(r) ? `${r.toFixed(2)}:1` : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  },
};

const TYPE = [
  ["Display", "text-[34px] leading-10 font-semibold tracking-tight"],
  ["Page title", "text-2xl font-semibold tracking-tight"],
  ["Section title", "text-base font-semibold"],
  ["Body (phones: 16px)", "text-sm max-md:text-base"],
  ["Dense UI", "text-[13px] leading-[18px] font-medium"],
  ["Caption", "text-xs font-medium text-muted-foreground"],
  ["Mono · amounts, numbers", "font-mono text-sm tabular"],
] as const;

export const Type: StoryObj = {
  render: () => (
    <div className="grid gap-4">
      {TYPE.map(([name, cls]) => (
        <div key={name} className="grid gap-1 border-b pb-3">
          <span className="font-mono text-xs text-muted-foreground">{name}</span>
          <span className={cls}>{name.startsWith("Mono") ? "$2,770.00 · 2026-0042" : "Taxes, done right."}</span>
        </div>
      ))}
    </div>
  ),
};

export const RadiusAndMotion: StoryObj = {
  name: "Radius and motion",
  render: () => (
    <div className="grid justify-items-center gap-10">
      <div className="flex flex-wrap justify-center gap-4">
        {["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-full"].map((r) => (
          <div key={r} className={`flex size-28 items-center justify-center border bg-card p-3 text-center font-mono text-xs ${r}`}>
            {r}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {["animate-page", "animate-slide", "animate-shield-pulse"].map((a) => (
          <div key={a} className={`flex h-16 w-44 items-center justify-center rounded-lg bg-brand-subtle font-mono text-xs text-brand-subtle-foreground ${a}`}>
            {a}
          </div>
        ))}
      </div>
    </div>
  ),
};
