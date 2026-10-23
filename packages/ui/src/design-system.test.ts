import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

// The gate for promoting a component to Storybook (PJ, 2026-10-23; CLAUDE.md "Non-negotiable"): a component lands in
// packages/ui already refactored, data in through props, behaviour out through callbacks, no app wiring, and with its
// stories and Docs "Use it" line. Never "add it now, refactor later". This test holds the parts a machine can check;
// hard-coded copy is the reviewer's half (see CLAUDE.md).

const ROOT = join(import.meta.dir, "..", "..", "..");
const COMPONENTS = join(import.meta.dir, "components");
const STORY_DIRS = [join(import.meta.dir, "stories"), join(ROOT, "apps", "site", "src", "stories")];

const components = readdirSync(COMPONENTS).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"));
const stories = STORY_DIRS.flatMap((d) => readdirSync(d).filter((f) => /\.(tsx?|mdx)$/.test(f)).map((f) => join(d, f)));
const storySource = stories.map((f) => readFileSync(f, "utf8")).join("\n");

// shadcn primitives Storybook only shows through the components built on them (AdminShell, the dashboard's charts),
// and modules that hold no component (hooks, types).
const NO_STORY_OF_THEIR_OWN = new Set(["sidebar", "chart", "tone", "use-mobile"]);

// App wiring never belongs in the design system: data fetching, routing, URL state, app aliases.
const WIRING = /^import[^;]*from\s+"(@trpc\/[^"]*|react-router[^"]*|nuqs[^"]*|@\/[^"]*|[^"]*\/apps\/[^"]*|@app\/(server|portal|admin|site)[^"]*)"/m;

describe("design-system components are ready for Storybook", () => {
  test.each(components)("%s imports no app wiring", (file) => {
    const src = readFileSync(join(COMPONENTS, file), "utf8");
    expect(src.match(WIRING)?.[0] ?? null).toBeNull();
    expect(src.match(/\bwindow\.location\b|(^|[^.\w])fetch\(/m)?.[0] ?? null).toBeNull();
    // Toasts are the app's to show; only the Toaster wrapper itself touches sonner.
    if (file !== "sonner.tsx") expect(src.match(/from\s+"sonner"/)?.[0] ?? null).toBeNull();
  });

  test.each(components.filter((f) => !NO_STORY_OF_THEIR_OWN.has(basename(f).replace(/\.tsx?$/, ""))))("%s has stories", (file) => {
    const name = basename(file).replace(/\.tsx?$/, "");
    const shown = storySource.includes(`components/${name}"`);
    expect(shown ? "has stories" : `no story imports components/${name}: write its stories before it lands`).toBe("has stories");
  });

  test.each(stories.filter((f) => f.endsWith(".stories.tsx") && !/tokens\.stories/.test(f)))("%s has a Docs \"Use it\" line", (file) => {
    expect(/usage/.test(readFileSync(file, "utf8")) ? "has usage" : "missing parameters.usage").toBe("has usage");
  });
});
