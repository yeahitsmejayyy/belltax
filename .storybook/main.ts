import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

// The design system's Storybook: packages/ui, shared by the portal, the admin and the site, plus the marketing
// site's own sections (apps/site, under "Site"), rendered from their real components with invented data.
// principles.md is the first page (packages/ui/src/principles.mdx).
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../packages/ui/src/**/*.mdx", "../packages/ui/src/**/*.stories.@(ts|tsx)", "../apps/site/src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  core: { disableTelemetry: true },
  staticDirs: [{ from: "../packages/ui/src/brand", to: "/brand" }],
  viteFinal: async (vite) => {
    vite.plugins = [...(vite.plugins ?? []), tailwindcss()];
    // The site's "@/…" imports. packages/ui uses relative imports, so the alias is the site's alone.
    vite.resolve = { ...vite.resolve, alias: { ...(vite.resolve?.alias as Record<string, string> | undefined), "@": fileURLToPath(new URL("../apps/site/src", import.meta.url)) } };
    return vite;
  },
};
export default config;
