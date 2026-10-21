import { describe, expect, test } from "bun:test";
import { sitePage } from "./page";

// Ticket 53: which page the site shows.

describe("sitePage", () => {
  test("the deploy setting decides, landing by default", () => {
    expect(sitePage("", undefined)).toBe("landing");
    expect(sitePage("", "splash")).toBe("splash");
    expect(sitePage("", "landing")).toBe("landing");
    expect(sitePage("", "something-else")).toBe("landing");
  });
  test("?page= previews the other one, and junk is ignored", () => {
    expect(sitePage("?page=landing", "splash")).toBe("landing");
    expect(sitePage("?page=splash", undefined)).toBe("splash");
    expect(sitePage("?page=admin", "splash")).toBe("splash");
  });
});

// Ticket 54: what the live site sends with every page (vercel.json). The site loads nothing from other hosts except
// the portal's public details, can't be framed, and never posts a form.
describe("vercel.json headers", () => {
  const config = JSON.parse(require("node:fs").readFileSync(new URL("../../../../vercel.json", import.meta.url), "utf8")) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const sent = Object.fromEntries(config.headers.find((h) => h.source === "/(.*)")!.headers.map((h) => [h.key, h.value]));
  test("a strict CSP on every page", () => {
    const csp = sent["Content-Security-Policy"]!;
    for (const rule of ["default-src 'self'", "script-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "form-action 'none'"]) expect(csp).toContain(rule);
    expect(csp).toContain("connect-src 'self' https://belltax-demo.onrender.com https://*.belltaxprep.com");
    expect(csp).not.toContain("unsafe-eval");
  });
  test("nosniff, a referrer policy and no framing", () => {
    expect(sent).toMatchObject({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY" });
  });
});
