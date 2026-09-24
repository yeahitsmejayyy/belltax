import { existsSync, statSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { PRODUCT_NAME } from "@app/schema";
import { appRouter } from "./appRouter";
import { runtime } from "./db/client";
import { downloadDocument, uploadDocument } from "./rest/documents";
import { createContext } from "./trpc";

// One host for everything: /trpc for the API, /health for a quick look, and the built SPA for
// every other path, so the demo deploys as a single process.

type Options = {
  webDist: string; // apps/web/dist
  devOrigin?: string; // the Vite dev server, allowed cross-origin in demo mode only
};

const count = (table: string) => (runtime().db.query(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

export function createFetchHandler({ webDist, devOrigin }: Options) {
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

  return async function fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);

    if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }), req);

    if (pathname.startsWith("/trpc")) {
      const res = await fetchRequestHandler({ endpoint: "/trpc", req, router: appRouter, createContext });
      return cors(res, req);
    }

    if (pathname === "/api/documents" && req.method === "POST") return cors(await uploadDocument(req, devOrigin), req);
    const file = pathname.match(/^\/api\/documents\/([0-9a-f-]{36})\/file$/);
    if (file && req.method === "GET") return cors(downloadDocument(req, file[1]!), req);
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
  };
}
