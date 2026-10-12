// Link-preview images (Open Graph / Twitter cards) for the site, portal and admin: 1200×630 PNGs in each app's
// public/og.png, drawn from the brand (wordmark, palette, Bricolage Grotesque + Space Grotesk) in headless Chromium.
// Run after changing the brand or the copy: bun scripts/share-cards.ts
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dir, "..");
const font = (pkg: string, file: string) =>
  `data:font/woff2;base64,${readFileSync(join(ROOT, "packages/ui/node_modules/@fontsource-variable", pkg, "files", file)).toString("base64")}`;
const svg = (name: string) => `data:image/svg+xml;base64,${readFileSync(join(ROOT, "packages/ui/src/brand", name)).toString("base64")}`;

const CARDS = [
  { app: "site", eyebrow: "Bell Tax", title: "Taxes made easy.", body: "Your personal tax agent, from your phone. Send documents, sign and pay in one place." },
  { app: "portal", eyebrow: "Client portal · demo", title: "Your tax return, from your phone.", body: "See where your return stands, answer a few questions, send documents, sign and pay." },
  { app: "admin", eyebrow: "Tax agent admin · demo", title: "The back office for a tax practice.", body: "Pipeline, returns, inbox, invoices and settings, on invented households." },
];

const page = (c: (typeof CARDS)[number]) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Bricolage"; src: url(${font("bricolage-grotesque", "bricolage-grotesque-latin-wght-normal.woff2")}) format("woff2"); font-weight: 200 800; }
@font-face { font-family: "Space"; src: url(${font("space-grotesk", "space-grotesk-latin-wght-normal.woff2")}) format("woff2"); font-weight: 300 700; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1200px; height: 630px; }
body { background: oklch(0.22 0 0); color: oklch(0.98 0 0); font-family: "Space", sans-serif; position: relative; overflow: hidden; padding: 72px 80px; display: flex; flex-direction: column; }
.grid { position: absolute; inset: 0; background-image: radial-gradient(circle, oklch(0.32 0 0) 1.2px, transparent 1.4px); background-size: 28px 28px; mask-image: linear-gradient(120deg, transparent 35%, black 100%); }
.mark { position: absolute; right: -80px; bottom: -130px; width: 440px; height: 440px; opacity: 0.95; transform: rotate(-8deg); }
.word { height: 52px; width: auto; position: relative; align-self: flex-start; }
.eyebrow { margin-top: auto; font-weight: 700; font-size: 22px; letter-spacing: 0.1em; text-transform: uppercase; color: oklch(0.9 0.18 120); position: relative; }
h1 { font-family: "Bricolage", sans-serif; font-weight: 800; font-size: 80px; line-height: 0.98; letter-spacing: -0.045em; margin-top: 18px; max-width: 760px; position: relative; }
p { font-size: 28px; line-height: 1.35; color: oklch(0.78 0 0); margin-top: 22px; max-width: 700px; position: relative; }
</style></head><body>
<div class="grid"></div>
<img class="mark" src="${svg("bell-mark-dark.svg")}" alt="">
<img class="word" src="${svg("bell-wordmark-dark.svg")}" alt="">
<div class="eyebrow">${c.eyebrow}</div>
<h1>${c.title}</h1>
<p>${c.body}</p>
</body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const c of CARDS) {
  await tab.setContent(page(c), { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  const out = join(ROOT, "apps", c.app, "public/og.png");
  await tab.screenshot({ path: out, type: "png" });
  console.log(`✔ apps/${c.app}/public/og.png`);
}
await browser.close();
