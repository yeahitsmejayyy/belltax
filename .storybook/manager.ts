import { addons } from "storybook/manager-api";
import { GLOBALS_UPDATED, SET_GLOBALS } from "storybook/internal/core-events";
import { create } from "storybook/theming";

// Storybook's own chrome, branded (the b. mark and the belltax. wordmark, outlined SVGs from packages/ui/src/brand)
// and following the Light / Dark toolbar switch, so the sidebar matches the story.

const brandTitle = (theme: "light" | "dark") => {
  const suffix = theme === "dark" ? "-dark" : "";
  return `<span style="display:inline-flex;align-items:center;gap:8px"><img src="brand/bell-mark${suffix}.svg" alt="" width="26" height="26" /><img src="brand/bell-wordmark${suffix}.svg" alt="belltax." height="20" /></span>`;
};

const shared = {
  brandUrl: "./",
  brandTarget: "_self",
  fontBase: '"Space Grotesk Variable", "Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  fontCode: '"Geist Mono Variable", ui-monospace, monospace',
};

// Light: charcoal ink with deep chartreuse accents. Dark: charcoal surfaces with a chartreuse primary (tokens.css).
const light = create({ ...shared, base: "light", brandTitle: brandTitle("light"), colorPrimary: "#2b2b2b", colorSecondary: "#5e7d1c", textColor: "#2b2b2b" });
const dark = create({
  ...shared,
  base: "dark",
  brandTitle: brandTitle("dark"),
  colorPrimary: "#c8f042",
  colorSecondary: "#c8f042",
  textInverseColor: "#2b2b2b",
  // The tokens' dark greys (oklch 0.20 / 0.245 / 0.32), so the chrome and the canvas are one surface.
  appBg: "#1c1c1c",
  appContentBg: "#252525",
  appPreviewBg: "#1c1c1c",
  appBorderColor: "#383838",
  barBg: "#252525",
  inputBg: "#2c2c2c",
});

addons.setConfig({ theme: light });

addons.register("btp/theme-sync", (api) => {
  const apply = (globals?: Record<string, unknown>) => api.setOptions({ theme: globals?.theme === "dark" ? dark : light });
  api.on(SET_GLOBALS, ({ globals }: { globals: Record<string, unknown> }) => apply(globals));
  api.on(GLOBALS_UPDATED, ({ globals }: { globals: Record<string, unknown> }) => apply(globals));
});
