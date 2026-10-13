// README screenshots, taken from the deployed public demo (invented data only) into docs/images/.
// Run after a deploy: bun scripts/screenshots.ts   (DEMO_URL / SITE_URL override the hosted addresses)
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

const ROOT = resolve(import.meta.dir, "..");
const OUT = join(ROOT, "docs/images");
const DEMO = (process.env.DEMO_URL ?? "https://belltax-demo.onrender.com").replace(/\/$/, "");
const SITE = (process.env.SITE_URL ?? "https://belltaxprep.vercel.app").replace(/\/$/, "");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark" as const };
const phone = { viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, colorScheme: "dark" as const, isMobile: true, hasTouch: true };

// The free Render plan sleeps: wake it before timing anything.
await fetch(`${DEMO}/health`).catch(() => null);
const tour = (await (await fetch(`${DEMO}/trpc/demo.tour`)).json()) as { result: { data: { client: { id: string } } } };
const client = tour.result.data.client.id;
const users = (await (await fetch(`${DEMO}/admin/trpc/demo.users`)).json()) as { result: { data: { id: string }[] } };
const preparer = users.result.data[0]!.id;
const host = new URL(DEMO).hostname;

async function shot(page: Page, url: string, name: string, opts: { full?: boolean } = {}) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800); // let page-in animations settle
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: opts.full ?? false });
  console.log(`✔ docs/images/${name}.png`);
}

// Hide the "Try this" hints so the screens show the product itself.
const quiet = async (page: Page) =>
  page.addInitScript(() => {
    try {
      localStorage.setItem("btp-demo-tips-portal-home", "1");
      localStorage.setItem("btp-demo-tips-admin-dashboard", "1");
    } catch {}
  });

{
  const ctx = await browser.newContext(desktop);
  const page = await ctx.newPage();
  await shot(page, SITE, "site");
  await ctx.clearCookies();
  await shot(page, `${DEMO}/sign-in`, "front-door");
  await ctx.addCookies([{ name: "btp_demo_admin", value: preparer, domain: host, path: "/" }]);
  await quiet(page);
  await shot(page, `${DEMO}/admin/dashboard`, "admin-dashboard");
  await shot(page, `${DEMO}/admin/pipeline`, "admin-pipeline");
  await ctx.close();
}
{
  const ctx = await browser.newContext(phone);
  await ctx.addCookies([{ name: "btp_demo_portal", value: client, domain: host, path: "/" }]);
  const page = await ctx.newPage();
  await quiet(page);
  await shot(page, `${DEMO}/`, "portal-home");
  await shot(page, `${DEMO}/documents`, "portal-documents");
  await ctx.close();
}
await browser.close();
