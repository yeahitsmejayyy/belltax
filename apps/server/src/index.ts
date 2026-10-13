import { join } from "node:path";
import { PRODUCT_NAME } from "@app/schema";
import { loadConfig, REPO_ROOT } from "./config";
import { runtime, useRuntime } from "./db/client";
import { bootDatabase } from "./db/open";
import { createFetchHandler, withAdminMounted } from "./http";
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
const publicDemo = config.mode === "demo" && config.publicDemo !== null;
useRuntime({ db, storage, mode: config.mode, dataDir: config.dataDir, publicDemo, stripe: config.stripe, links: config.links });

const log = createRequestLog({ mode: config.mode, dataDir: config.dataDir });

// Two listeners, both on 127.0.0.1. The portal is the only one a tunnel may forward; the admin never
// leaves this machine, and preparer procedures don't exist on the portal at all.
const portal = createFetchHandler({ surface: "portal", webDist: join(REPO_ROOT, "apps/portal/dist"), devOrigin: "http://localhost:5173", log });
const admin = createFetchHandler({ surface: "admin", webDist: join(REPO_ROOT, "apps/admin/dist"), devOrigin: "http://localhost:5174", log });

if (config.publicDemo) {
  // The hosted demo (docs/demo-deploy.md): one public port, the admin at /admin/ on it, and the invented
  // world wiped and re-seeded on a timer so nothing a visitor typed stays for long.
  const server = Bun.serve({ ...serverOptions(config), fetch: (req, srv) => withAdminMounted(portal, admin)(req, srv.requestIP(req)?.address) });
  const reset = config.publicDemo.resetHours;
  setInterval(async () => {
    const previous = runtime().db;
    const fresh = await bootDatabase(config, { storage });
    useRuntime({ db: fresh.db, storage, mode: config.mode, dataDir: config.dataDir, publicDemo, stripe: config.stripe, links: config.links });
    previous.close();
    console.log(`  demo world re-seeded on its ${reset} h timer`);
  }, reset * 3_600_000);
  console.log(`${PRODUCT_NAME} [PUBLIC DEMO]`);
  console.log(`  ${server.url}  portal, with the admin at /admin/  (invented data, uploads off, re-seeded every ${reset} h)`);
  if (seeded) console.log(`  demo world seeded: ${seeded.households} households, ${seeded.returns} returns, tax year ${seeded.taxYear}`);
} else {
  const portalServer = Bun.serve({ ...serverOptions(config), fetch: (req, srv) => portal(req, srv.requestIP(req)?.address) });
  const adminServer = Bun.serve({ ...adminServerOptions(config), fetch: (req, srv) => admin(req, srv.requestIP(req)?.address) });

  console.log(`${PRODUCT_NAME} [${config.mode.toUpperCase()}]`);
  console.log(`  portal: ${portalServer.url}  (the only port a tunnel may forward)`);
  console.log(`  admin:  ${adminServer.url}  (this machine only)`);
  if (seeded) console.log(`  demo world re-seeded: ${seeded.households} households, ${seeded.returns} returns, tax year ${seeded.taxYear}`);
}
