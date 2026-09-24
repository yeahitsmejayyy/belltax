import { loadConfig } from "../../config";
import { bootDatabase } from "../open";

// `bun run seed` — rebuild the demo world without starting the server. Always demo, never live.
const config = loadConfig({ ...process.env, RUN_MODE: "demo" });
const { db, seeded } = await bootDatabase(config);
db.close();

console.log(`Seeded demo world in ${config.dataDir}`);
console.log(`  tax year ${seeded!.taxYear} · ${seeded!.households} households · ${seeded!.returns} returns · ${seeded!.documents} documents`);
console.log("  Demo logins (one-click sign-in arrives with task 05):");
for (const l of seeded!.logins) console.log(`    ${l.role.padEnd(8)} ${l.email.padEnd(34)} ${l.label}`);
