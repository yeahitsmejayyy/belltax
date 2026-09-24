import { PRODUCT_NAME } from "@app/schema";
import { loadConfig } from "./config";
import { bootDatabase } from "./db/open";

// Placeholder entry; task 04 replaces this with the skelly-backend server.
const config = loadConfig();
const { db, seeded } = await bootDatabase(config);

const count = (table: string) => (db.query(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

const server = Bun.serve({
  port: config.port,
  hostname: "127.0.0.1",
  fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/health") {
      return Response.json({
        product: PRODUCT_NAME,
        mode: config.mode,
        households: count("households"),
        returns: count("engagements"),
        documents: count("documents"),
      });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`${PRODUCT_NAME} [${config.mode.toUpperCase()}] on ${server.url}`);
if (seeded) console.log(`Demo world re-seeded: ${seeded.households} households, ${seeded.returns} returns, tax year ${seeded.taxYear}`);
