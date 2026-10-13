import { join } from "node:path";
import { now } from "@app/schema";
import { loadConfig } from "../config";
import { useRuntime } from "../db/client";
import { migrationStatus } from "../db/migrate";
import { connect, DB_FILE } from "../db/open";
import { appendEvent } from "../events";
import { createStorage } from "../storage";
import { linkFor } from "./auth";

// bun run preparer:invite <email>   a one-time link that sets the preparer's password (ticket 05).
// The first time it creates the preparer's login; after that it's a reset (and the email must match).
// Live mode, on the practice machine: the link opens the admin, which only answers there.
// Demo mode signs in with the picker and re-seeds on every boot, so this is for live.

const email = process.argv[2]?.trim();
const config = loadConfig();
if (!email || !email.includes("@")) {
  console.error("Usage: bun run preparer:invite you@yourpractice.com");
  process.exit(1);
}
if (config.mode !== "live") {
  console.error("Demo mode signs in with the picker. Run this with RUN_MODE=live on the practice machine.");
  process.exit(1);
}
const db = connect(join(config.dataDir, DB_FILE));
try {
  if (migrationStatus(db).pending.length) throw new Error("The database is behind the code. Back it up, then run: bun run migrate");
  useRuntime({ db, storage: createStorage(config.dataDir), mode: config.mode, dataDir: config.dataDir, links: config.links });
  let preparer = db.query<{ id: string; email: string }, []>("SELECT id, email FROM users WHERE role = 'preparer' ORDER BY created_at LIMIT 1").get();
  if (preparer && preparer.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error(`The preparer's login is ${preparer.email}. Use that address (change it in Settings once signed in).`);
  }
  if (!preparer) {
    const id = Bun.randomUUIDv7();
    db.transaction(() => {
      db.run("INSERT INTO users (id, role, email, created_at) VALUES (?, 'preparer', ?, ?)", [id, email, now()]);
      appendEvent(db, { actor: "system", type: "login.created", subjectType: "user", subjectId: id, data: { role: "preparer", from: "cli" } });
    })();
    preparer = { id, email };
  }
  const { url, expiresAt } = linkFor(preparer.id, (db.query("SELECT password_hash FROM users WHERE id = ?").get(preparer.id) as { password_hash: string | null }).password_hash ? "reset" : "invite", null);
  console.log(`✔ One-time link for ${preparer.email} (works once, until ${expiresAt}):\n\n  ${url}\n\nOpen it on this machine. Don't paste it anywhere else.`);
} catch (e) {
  console.error(`✖ ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  db.close();
}
