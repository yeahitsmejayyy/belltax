import { addons } from "storybook/manager-api";
import { GLOBALS_UPDATED, SET_GLOBALS } from "storybook/internal/core-events";
import { create } from "storybook/theming";

// Storybook's own chrome, branded (the shield and the one-word wordmark) and following the Light / Dark
// toolbar switch, so the sidebar matches the story.

const brandTitle = (color: string) =>
  `<span style="display:inline-flex;align-items:center;gap:8px;font-family:Geist,ui-sans-serif,system-ui,sans-serif;font-weight:700;font-size:17px;letter-spacing:-0.025em;color:${color}"><img src="brand/btp-mark.svg" alt="" width="22" height="26" />BellTaxPrep</span>`;

const shared = {
  brandUrl: "./",
  brandTarget: "_self",
  colorPrimary: "#3B82F6",
  colorSecondary: "#3B82F6",
  fontBase: '"Geist Variable", Geist, ui-sans-serif, system-ui, sans-serif',
  fontCode: '"Geist Mono Variable", ui-monospace, monospace',
};

const light = create({ ...shared, base: "light", brandTitle: brandTitle("#0a0a0a") });
const dark = create({
  ...shared,
  base: "dark",
  brandTitle: brandTitle("#fafafa"),
  // The tokens' dark greys (oklch 0.135 / 0.18 / 0.27), so the chrome and the canvas are one surface.
  appBg: "#0d0d0d",
  appContentBg: "#161616",
  appPreviewBg: "#0d0d0d",
  appBorderColor: "#2a2a2a",
  barBg: "#161616",
  inputBg: "#1f1f1f",
});

addons.setConfig({ theme: light });

addons.register("btp/theme-sync", (api) => {
  const apply = (globals?: Record<string, unknown>) => api.setOptions({ theme: globals?.theme === "dark" ? dark : light });
  api.on(SET_GLOBALS, ({ globals }: { globals: Record<string, unknown> }) => apply(globals));
  api.on(GLOBALS_UPDATED, ({ globals }: { globals: Record<string, unknown> }) => apply(globals));
});
