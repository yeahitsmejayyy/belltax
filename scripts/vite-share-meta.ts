import type { Plugin } from "vite";

// Link previews need absolute URLs. Each app's index.html writes %SHARE_URL% (its public address) and
// %SHARE_IMAGE% (its public/og.png, from scripts/share-cards.ts); this fills them in at build time from
// PUBLIC_ORIGIN, or the host's own variable (Render: RENDER_EXTERNAL_URL; Vercel: VERCEL_PROJECT_PRODUCTION_URL).
// Locally they fall back to relative paths, which is fine: nothing scrapes localhost.
export function shareMeta(): Plugin {
  let base = "/";
  return {
    name: "share-meta",
    configResolved(c) {
      base = c.base;
    },
    transformIndexHtml(html) {
      const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
      const origin = (process.env.PUBLIC_ORIGIN ?? process.env.RENDER_EXTERNAL_URL ?? (vercel ? `https://${vercel}` : "")).replace(/\/$/, "");
      return html.replaceAll("%SHARE_URL%", `${origin}${base}`).replaceAll("%SHARE_IMAGE%", `${origin}${base}og.png`);
    },
  };
}
