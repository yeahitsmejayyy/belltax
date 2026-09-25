import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

// The design system's Storybook: packages/ui, shared by the portal, the admin and the site.
// principles.md is the first page (packages/ui/src/principles.mdx).
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../packages/ui/src/**/*.mdx", "../packages/ui/src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  core: { disableTelemetry: true },
  staticDirs: [{ from: "../packages/ui/src/brand", to: "/brand" }],
  viteFinal: async (vite) => {
    vite.plugins = [...(vite.plugins ?? []), tailwindcss()];
    return vite;
  },
};
export default config;
