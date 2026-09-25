import { join } from "node:path";
import { PRODUCT_NAME } from "@app/schema";
import { loadConfig, REPO_ROOT } from "./config";
import { useRuntime } from "./db/client";
import { bootDatabase } from "./db/open";
import { createFetchHandler } from "./http";
import { adminServerOptions, assertLiveReady, serverOptions } from "./live/hardening";
import { createRequestLog } from "./request-log";
import { createStorage } from "./storage";

const config = loadConfig();
if (config.mode === "live") {
  const tunnelTargetPort = process.env.TUNNEL_TARGET_PORT ? Number(process.env.TUNNEL_TARGET_PORT) : undefined;
  for (const c of assertLiveReady(config, { backupDir: process.env.BACKUP_DIR, tunnelTargetPort })) {
    if (c.status !== "ok") console.warn(`! ${c.name}: ${c.detail}`);
  }
}
const storage = createStorage(config.dataDir);
const { db, seeded } = await bootDatabase(config, { storage });
useRuntime({ db, storage, mode: config.mode, dataDir: config.dataDir });

const log = createRequestLog({ mode: config.mode, dataDir: config.dataDir });

// Two listeners, both on 127.0.0.1. The portal is the only one a tunnel may forward; the admin never
// leaves this machine, and preparer procedures don't exist on the portal at all.
const portal = createFetchHandler({ surface: "portal", webDist: join(REPO_ROOT, "apps/portal/dist"), devOrigin: "http://localhost:5173", log });
const admin = createFetchHandler({ surface: "admin", webDist: join(REPO_ROOT, "apps/admin/dist"), devOrigin: "http://localhost:5174", log });

const portalServer = Bun.serve({ ...serverOptions(config), fetch: (req, srv) => portal(req, srv.requestIP(req)?.address) });
const adminServer = Bun.serve({ ...adminServerOptions(config), fetch: (req, srv) => admin(req, srv.requestIP(req)?.address) });

console.log(`${PRODUCT_NAME} [${config.mode.toUpperCase()}]`);
console.log(`  portal: ${portalServer.url}  (the only port a tunnel may forward)`);
console.log(`  admin:  ${adminServer.url}  (this machine only)`);
if (seeded) console.log(`  demo world re-seeded: ${seeded.households} households, ${seeded.returns} returns, tax year ${seeded.taxYear}`);
