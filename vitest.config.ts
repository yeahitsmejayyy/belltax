import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Storybook interaction tests (bun run test:storybook): every story renders in real Chromium and its
// play function runs. Kept apart from `bun test`, which runs the server and schema suites.
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [storybookTest({ configDir: path.join(import.meta.dirname, ".storybook") })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            // CI installs Playwright's own Chromium. Locally, CHROMIUM_PATH can point at any Chromium already
            // on the machine instead of downloading another.
            provider: playwright({ launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {} }),
            instances: [{ browser: "chromium" }],
            // Most stories are desktop references (the admin); phone behaviour is tested with explicit widths.
            viewport: { width: 1280, height: 800 },
          },
        },
      },
    ],
  },
});
