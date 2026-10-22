import { Canvas, Controls, Description, Source, Subtitle, Title, useOf } from "@storybook/addon-docs/blocks";
import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect } from "react";

import "../packages/ui/src/tokens.css";
import "./storybook.css";

// Light / dark from the toolbar, applied the way the apps do it: a class on <html>. Every story sits dead
// centre in its canvas, for focus. Wide ones (tables, boards, token grids) set `parameters.fill` and get a
// full-width column that is itself centred.
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme === "dark" ? "dark" : "light";
  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);
  const fill = context.parameters.fill === true;
  // On a Docs page each story is a block in a long page: no full-screen centring, just the story with room around it.
  if (context.viewMode === "docs") {
    if (context.parameters.site === true) return <div className="site-root bg-background text-foreground"><Story /></div>;
    if (context.parameters.shell === true || context.parameters.edge === "top") return <div className="bg-background text-foreground"><Story /></div>;
    return (
      <div className="flex w-full justify-center bg-background p-6 text-foreground">
        <div className={fill ? "w-full" : "flex w-full justify-center"}>
          <Story />
        </div>
      </div>
    );
  }
  // Marketing-site sections render as on the page: full width, from the top, with the site's own rules.
  if (context.parameters.site === true) return <div className="site-root min-h-screen bg-background text-foreground"><Story /></div>;
  // App shells own the whole canvas.
  if (context.parameters.shell === true) return <div className="h-screen bg-background text-foreground"><Story /></div>;
  // Bars that run across the top of the window (the demo tour bar): full width, at the top.
  if (context.parameters.edge === "top") return <div className="min-h-screen bg-background text-foreground"><Story /></div>;
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-8 text-foreground">
      <div className={fill ? "w-full max-w-6xl" : "flex w-full max-w-6xl justify-center"}>
        <Story />
      </div>
    </div>
  );
};

// Today's phones and a tablet, in CSS pixels (ticket 56). "phone" is the size the apps are designed at.
const VIEWPORTS: Record<string, { name: string; styles: { width: string; height: string }; type: "mobile" | "tablet" }> = {
  phone: { name: "iPhone 16 Pro · 402 × 874", styles: { width: "402px", height: "874px" }, type: "mobile" },
  phoneMax: { name: "iPhone 16 Pro Max · 440 × 956", styles: { width: "440px", height: "956px" }, type: "mobile" },
  pixel: { name: "Pixel 9 · 412 × 923", styles: { width: "412px", height: "923px" }, type: "mobile" },
  phoneSmall: { name: "iPhone SE · 375 × 667", styles: { width: "375px", height: "667px" }, type: "mobile" },
  tablet: { name: "iPad Air · 820 × 1180", styles: { width: "820px", height: "1180px" }, type: "tablet" },
};

// A story that sets a phone viewport, drawn on a Docs page at that phone's size: its own iframe, so the app's
// breakpoints see a phone, centred, with the code underneath.
function PhoneStory({ id, viewport }: { id: string; viewport: string }) {
  const { width, height } = VIEWPORTS[viewport]!.styles;
  const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  return (
    <div className="sb-unstyled" style={{ display: "flex", justifyContent: "center", padding: "24px 0", margin: "16px 0", borderRadius: 8, border: "1px solid var(--border)" }}>
      <iframe
        title={id}
        src={`iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`}
        style={{ width, height, maxWidth: "100%", border: "1px solid var(--border)", borderRadius: 24, background: "var(--background)" }}
      />
    </div>
  );
}

type DocsStory = { id: string; name: string; tags?: string[]; globals?: { viewport?: { value?: string } }; moduleExport: never };

// Every story on the page, in the sidebar's order, each with its code; phone stories at phone size. The first one
// leads the page, with the props table under it.
type IndexEntry = { id: string; title: string; type: string; tags?: string[] };
function AllStories() {
  const of = useOf("meta");
  if (of.type !== "meta") return null;
  const index = (window as unknown as { __STORYBOOK_PREVIEW__?: { storyStoreValue?: { storyIndex?: { entries: Record<string, IndexEntry> } } } }).__STORYBOOK_PREVIEW__?.storyStoreValue?.storyIndex?.entries ?? {};
  const byId = of.csfFile.stories as unknown as Record<string, DocsStory>;
  const stories = Object.values(index)
    .filter((e) => e.type === "story" && e.title === of.csfFile.meta.title && !!e.tags?.includes("autodocs") && byId[e.id])
    .map((e) => byId[e.id]!);
  return (
    <>
      {stories.map((s, i) => {
        const viewport = s.globals?.viewport?.value;
        return (
          <section key={s.id}>
            {i === 1 ? <h2>Stories</h2> : null}
            {i > 0 ? <h3>{s.name}</h3> : null}
            {viewport && VIEWPORTS[viewport] ? (
              <>
                <PhoneStory id={s.id} viewport={viewport} />
                <Source of={s.moduleExport} />
              </>
            ) : (
              <Canvas of={s.moduleExport} />
            )}
            {i === 0 ? <Controls of={s.moduleExport} /> : null}
          </section>
        );
      })}
    </>
  );
}

// Every Docs page (ticket 56): the title and notes, then "Use it" (the import line, from the story file's usage), the
// main story with its code and props, then every other story, each with Show code.
function DocsPage() {
  const of = useOf("meta");
  const params = of.type === "meta" ? (of.preparedMeta.parameters as { usage?: string; snippets?: { title: string; description?: string; code: string }[] }) : {};
  const { usage, snippets = [] } = params;
  return (
    <>
      <Title />
      <Subtitle />
      <Description />
      {usage ? (
        <>
          <h3>Use it</h3>
          <Source code={usage} language="tsx" dark />
        </>
      ) : null}
      {/* The data a component takes, each as its own block (parameters.snippets): sample rows, column config, then how they're passed. */}
      {snippets.map((sn) => (
        <section key={sn.title}>
          <h3>{sn.title}</h3>
          {sn.description ? <p>{sn.description}</p> : null}
          <Source code={sn.code} language="tsx" dark />
        </section>
      ))}
      <AllStories />
    </>
  );
}

const preview: Preview = {
  decorators: [withTheme],
  // Every component gets a Docs page (ticket 56): each story with Show code, the props from its types, and the usage
  // notes in the story file. Hidden test twins (tags: ["!dev"]) never appear there.
  tags: ["autodocs"],
  globalTypes: {
    theme: {
      description: "Colour theme",
      toolbar: { title: "Theme", icon: "mirror", items: [{ value: "light", title: "Light" }, { value: "dark", title: "Dark" }], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light" },
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    // Accessibility checks run on every story. "todo" reports without failing while the two contrast
    // questions in principles.md are open; switch to "error" once they're settled.
    a11y: { test: "todo" },
    options: { storySort: { order: ["Principles", "Tokens", "Primitives", "Admin", "Portal", "Site"] } },
    // Today's phones (CSS pixels), not Storybook's 2010-era defaults. "phone" is the size the apps are designed at.
    viewport: { options: VIEWPORTS },
    docs: { page: DocsPage, codePanel: true, source: { type: "dynamic", excludeDecorators: true } },
  },
};
export default preview;
