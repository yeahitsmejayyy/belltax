import { existsSync, statSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { PRODUCT_NAME } from "@app/schema";
import { appRouter } from "./appRouter";
import { runtime } from "./db/client";
import { downloadDocument, uploadDocument } from "./rest/documents";
import type { Surface } from "./identity";
import { createContext } from "./trpc";

// One handler per listener (portal or admin): /trpc for the API, /api for files, /health for a quick
// look, and that surface's built app (apps/portal/dist or apps/admin/dist) for every other path.

type Options = {
  surface: Surface; // which listener this handler serves
  webDist: string; // the built app for this surface: apps/portal/dist or apps/admin/dist
  devOrigin?: string; // that app's Vite dev server, allowed cross-origin in demo mode only
};

// Every response on both listeners carries these. The built apps are self-contained: no inline or
// third-party script. Styles allow 'unsafe-inline' because Radix and Sonner inject <style> at runtime;
// script is where the risk is, and it stays 'self' only.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function withSecurityHeaders(res: Response, pathname: string): Response {
  const headers = new Headers(res.headers);
  headers.set("Content-Security-Policy", CSP);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  // The tunnel terminates TLS in front of us; in demo there's no HTTPS to pin.
  if (runtime().mode === "live") headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // Anything that isn't the app shell or its assets may carry client data: never cache it.
  const api = pathname.startsWith("/trpc") || pathname.startsWith("/api/") || pathname === "/health";
  if (api && !headers.get("Cache-Control")?.includes("no-store")) headers.set("Cache-Control", "no-store");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

const count = (table: string) => (runtime().db.query(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

export function createFetchHandler({ surface, webDist, devOrigin }: Options) {
  const cors = (res: Response, req: Request) => {
    const origin = req.headers.get("origin");
    if (!devOrigin || origin !== devOrigin || runtime().mode !== "demo") return res;
    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Origin", devOrigin);
    headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, x-demo-user");
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };

  const serveSpa = (pathname: string) => {
    const index = join(webDist, "index.html");
    if (!existsSync(index)) {
      return new Response(`${PRODUCT_NAME}: the web app isn't built yet. Build apps/web, then reload.`, {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    // Resolve inside dist only; anything that isn't a real file falls back to index.html (client routes).
    const target = normalize(join(webDist, decodeURIComponent(pathname)));
    const inside = target.startsWith(webDist.endsWith(sep) ? webDist : webDist + sep);
    const file = inside && existsSync(target) && statSync(target).isFile() ? target : index;
    const immutable = file !== index && pathname.startsWith("/assets/");
    return new Response(Bun.file(file), {
      headers: { "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache" },
    });
  };

  return async function fetch(req: Request, socketIp?: string): Promise<Response> {
    const { pathname } = new URL(req.url);
    return withSecurityHeaders(await route(req, pathname, socketIp), pathname);
  };

  async function route(req: Request, pathname: string, socketIp?: string): Promise<Response> {

    if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }), req);

    if (pathname.startsWith("/trpc")) {
      const res = await fetchRequestHandler({ endpoint: "/trpc", req, router: appRouter, createContext: (o) => createContext({ req: o.req, ip: socketIp, surface }) });
      return cors(res, req);
    }

    if (pathname === "/api/documents" && req.method === "POST") return cors(await uploadDocument(req, surface, devOrigin), req);
    const file = pathname.match(/^\/api\/documents\/([0-9a-f-]{36})\/file$/);
    if (file && req.method === "GET") return cors(downloadDocument(req, surface, file[1]!), req);
    if (pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });

    if (pathname === "/health") {
      return Response.json({
        product: PRODUCT_NAME,
        mode: runtime().mode,
        households: count("households"),
        returns: count("engagements"),
        documents: count("documents"),
      });
    }

    if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    return serveSpa(pathname);
  }
}
