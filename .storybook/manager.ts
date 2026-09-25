import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

// Storybook's own chrome, branded: the shield and the wordmark (Geist 700, one word) instead of the Storybook logo.
addons.setConfig({
  theme: create({
    base: "light",
    brandTitle: `<span style="display:inline-flex;align-items:center;gap:8px;font-family:Geist,ui-sans-serif,system-ui,sans-serif;font-weight:700;font-size:17px;letter-spacing:-0.025em;color:#0a0a0a"><img src="brand/btp-mark.svg" alt="" width="22" height="26" />BellTaxPrep</span>`,
    brandUrl: "./",
    brandTarget: "_self",
    colorPrimary: "#3B82F6",
    colorSecondary: "#3B82F6",
    fontBase: '"Geist Variable", Geist, ui-sans-serif, system-ui, sans-serif',
    fontCode: '"Geist Mono Variable", ui-monospace, monospace',
  }),
});
