import { join } from "node:path";
import { PRODUCT_NAME } from "@app/schema";
import { loadConfig, REPO_ROOT } from "./config";
import { useRuntime } from "./db/client";
import { bootDatabase } from "./db/open";
import { createFetchHandler } from "./http";
import { createStorage } from "./storage";

const config = loadConfig();
const storage = createStorage(config.dataDir);
const { db, seeded } = await bootDatabase(config, { storage });
useRuntime({ db, storage, mode: config.mode });

const handle = createFetchHandler({ webDist: join(REPO_ROOT, "apps/web/dist"), devOrigin: "http://localhost:5173" });

const server = Bun.serve({
  port: config.port,
  hostname: "127.0.0.1", // never a public port; the live instance stays on this machine
  fetch: (req, srv) => handle(req, srv.requestIP(req)?.address),
});

console.log(`${PRODUCT_NAME} [${config.mode.toUpperCase()}] on ${server.url}`);
console.log(`  tRPC: ${server.url}trpc · health: ${server.url}health`);
if (seeded) console.log(`  demo world re-seeded: ${seeded.households} households, ${seeded.returns} returns, tax year ${seeded.taxYear}`);
