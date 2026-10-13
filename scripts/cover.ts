// The README's cover image (docs/images/cover.png): the brand, one line on what it is, and the product itself (the tax
// agent's pipeline in a window, a client's phone in front), built from the screenshots in docs/images/.
// Run after scripts/screenshots.ts: bun scripts/cover.ts
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dir, "..");
const b64 = (path: string, type: string) => `data:${type};base64,${readFileSync(join(ROOT, path)).toString("base64")}`;
const font = (pkg: string, file: string) => b64(`packages/ui/node_modules/@fontsource-variable/${pkg}/files/${file}`, "font/woff2");
const img = (name: string) => b64(`docs/images/${name}.png`, "image/png");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Bricolage"; src: url(${font("bricolage-grotesque", "bricolage-grotesque-latin-wght-normal.woff2")}) format("woff2"); font-weight: 200 800; }
@font-face { font-family: "Space"; src: url(${font("space-grotesk", "space-grotesk-latin-wght-normal.woff2")}) format("woff2"); font-weight: 300 700; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1600px; height: 820px; }
body { background: oklch(0.2 0 0); color: oklch(0.98 0 0); font-family: "Space", sans-serif; position: relative; overflow: hidden; }
.grid { position: absolute; inset: 0; background-image: radial-gradient(circle, oklch(0.32 0 0) 1.2px, transparent 1.4px); background-size: 26px 26px; mask-image: linear-gradient(100deg, black 0%, transparent 70%); }
.glow { position: absolute; width: 900px; height: 900px; right: -200px; top: -120px; background: radial-gradient(closest-side, oklch(0.9 0.18 120 / 0.16), transparent); }
.copy { position: absolute; left: 72px; top: 80px; width: 500px; display: flex; flex-direction: column; gap: 26px; }
.word { height: 46px; width: auto; align-self: flex-start; }
h1 { font-family: "Bricolage", sans-serif; font-weight: 800; font-size: 52px; line-height: 1; letter-spacing: -0.045em; }
h1 em { font-style: normal; color: oklch(0.9 0.18 120); }
p { font-size: 20px; line-height: 1.45; color: oklch(0.78 0 0); }
.chips { display: flex; flex-wrap: wrap; gap: 10px; }
.chip { font-size: 15px; font-weight: 500; padding: 7px 14px; border-radius: 999px; border: 1px solid oklch(0.34 0 0); color: oklch(0.88 0 0); background: oklch(0.24 0 0); }
.chip b { color: oklch(0.9 0.18 120); font-weight: 600; }
.window { position: absolute; left: 720px; top: 80px; width: 1060px; border-radius: 16px; overflow: hidden; border: 1px solid oklch(0.36 0 0); box-shadow: 0 40px 80px -30px black; background: oklch(0.2 0 0); }
.bar { height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 14px; background: oklch(0.26 0 0); }
.bar i { width: 11px; height: 11px; border-radius: 50%; background: oklch(0.42 0 0); }
.bar span { margin-left: 12px; font-size: 13px; color: oklch(0.65 0 0); }
.window img { display: block; width: 100%; }
/* A phone with its own status bar and home indicator, so the screenshot's top and bottom never meet the curve. */
.phone { position: absolute; left: 600px; top: 150px; width: 262px; border-radius: 50px; padding: 10px; background: oklch(0.1 0 0); border: 1.5px solid oklch(0.4 0 0); box-shadow: 0 0 0 5px oklch(0.16 0 0), 0 50px 90px -20px black; }
.screen { border-radius: 40px; overflow: hidden; background: oklch(0.22 0 0); }
.status { position: relative; height: 40px; display: flex; align-items: center; justify-content: space-between; padding: 6px 26px 0; font: 600 13px "Space", sans-serif; color: oklch(0.98 0 0); }
.status .island { position: absolute; left: 50%; top: 10px; width: 84px; height: 24px; margin-left: -42px; border-radius: 999px; background: black; }
.status .icons { display: flex; gap: 5px; align-items: center; }
.status .icons i { display: block; width: 15px; height: 9px; border-radius: 2px; border: 1.5px solid currentColor; }
.status .icons i:first-child { width: 12px; border: 0; background: linear-gradient(to right, currentColor 0 2px, transparent 2px 4px, currentColor 4px 6px, transparent 6px 8px, currentColor 8px 10px); height: 9px; }
.screen img { display: block; width: 100%; }
.home { height: 22px; display: grid; place-items: center; background: oklch(0.2 0 0); }
.home i { width: 96px; height: 5px; border-radius: 999px; background: oklch(0.95 0 0 / 0.7); }
</style></head><body>
<div class="grid"></div><div class="glow"></div>
<div class="copy">
  <img class="word" src="${b64("packages/ui/src/brand/bell-wordmark-dark.svg", "image/svg+xml")}" alt="">
  <h1>The client portal and back office for a <em>tax practice.</em></h1>
  <p>Clients send documents, sign and pay from their phone. The tax agent runs every return from one pipeline.</p>
  <div class="chips">
    <span class="chip"><b>Live demo</b> · invented data</span>
    <span class="chip">Bun · tRPC · React 19</span>
    <span class="chip">SQLite · Stripe</span>
    <span class="chip">Storybook design system</span>
  </div>
</div>
<div class="window"><div class="bar"><i></i><i></i><i></i><span>belltax. admin · Pipeline</span></div><img src="${img("admin-pipeline")}" alt=""></div>
<div class="phone"><div class="screen"><div class="status"><span>9:41</span><span class="island"></span><span class="icons"><i></i><i></i></span></div><img src="${img("portal-home")}" alt=""><div class="home"><i></i></div></div></div>
</body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 820 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(ROOT, "docs/images/cover.png") });
await browser.close();
console.log("✔ docs/images/cover.png");
