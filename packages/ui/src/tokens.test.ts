import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contrast } from "./contrast";

// principles.md rule 5, enforced on the tokens themselves: every text pair meets 4.5:1 and every
// icon/UI pair 3:1, in both themes. One pair from the design handoff doesn't yet; they're listed in
// principles.md ("Open questions") and pinned here at their current value so they can't quietly get worse.

const css = readFileSync(join(import.meta.dir, "tokens.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}
const light = block(":root");
const dark = { ...light, ...block(".dark") };
const resolve = (theme: Record<string, string>, name: string): string => {
  const v = theme[name];
  if (!v) throw new Error(`no token --${name}`);
  const ref = v.match(/^var\(--([a-z0-9-]+)\)$/);
  return ref ? resolve(theme, ref[1]!) : v;
};

const TEXT: [string, string][] = [
  ["foreground", "background"], ["foreground", "card"], ["card-foreground", "card"], ["popover-foreground", "popover"],
  ["muted-foreground", "background"], ["muted-foreground", "card"], ["muted-foreground", "muted"],
  ["secondary-foreground", "secondary"], ["accent-foreground", "accent"],
  ["brand-subtle-foreground", "brand-subtle"], ["success-foreground", "success-subtle"], ["warning-foreground", "warning-subtle"],
  ["danger-foreground", "danger-subtle"], ["info-foreground", "info-subtle"], ["mode-demo-fg", "mode-demo-bg"],
  ["sidebar-foreground", "sidebar"], ["sidebar-accent-foreground", "sidebar-accent"],
  ["primary-foreground", "primary"], ["primary", "background"], ["primary", "card"],
];
const UI: [string, string][] = [
  ["ring", "background"], ["success", "card"], ["warning", "card"], ["danger", "card"], ["info", "card"], ["primary", "card"],
];

// Open questions in principles.md: [theme, fg, bg] → the ratio it measures today.
// The belltax. palette (charcoal / chartreuse) closed the brand-blue ones; the amber warning icon remains.
const KNOWN: Record<string, number> = {
  "light warning/card": 2.55,
};

describe("token contrast (principles.md rule 5)", () => {
  for (const [name, theme] of [["light", light], ["dark", dark]] as const) {
    for (const [pairs, min] of [[TEXT, 4.5], [UI, 3]] as const) {
      for (const [fg, bg] of pairs) {
        const key = `${name} ${fg}/${bg}`;
        test(`${key} ≥ ${min}`, () => {
          const ratio = contrast(resolve(theme, fg), resolve(theme, bg));
          if (key in KNOWN) expect(ratio).toBeGreaterThanOrEqual(KNOWN[key]! - 0.01);
          else expect(ratio).toBeGreaterThanOrEqual(min);
        });
      }
    }
  }

  test("the known shortfalls are still short (drop them from KNOWN once fixed)", () => {
    for (const key of Object.keys(KNOWN)) {
      const [name, pair] = key.split(" ") as [string, string];
      const [fg, bg] = pair.split("/") as [string, string];
      const theme = name === "light" ? light : dark;
      const min = TEXT.some(([a, b]) => a === fg && b === bg) ? 4.5 : 3;
      expect({ key, passes: contrast(resolve(theme, fg), resolve(theme, bg)) >= min }).toEqual({ key, passes: false });
    }
  });
});

test("the belltax. brand: charcoal primary in light, chartreuse in dark, as designed", () => {
  expect(resolve(light, "primary")).toBe("oklch(0.22 0 0)");
  expect(resolve(dark, "primary")).toBe("oklch(0.9 0.18 120)");
  expect(resolve(light, "ring")).toBe("oklch(0.52 0.13 125)");
  expect(light.radius).toBe("0.75rem");
});
