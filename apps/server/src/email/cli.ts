import { loadEmail } from "../config";
import { deliverWithResend } from "./email";
import { signInChangedEmail } from "./templates";

// bun run email:test you@example.com   one real email through Resend, with the live settings (docs/email.md).
// Load the settings first:  set -a; source ~/BellTaxPrep/live.env; set +a
// Sends a harmless "this is a test" message in the practice's layout. Touches no database and no client.

const to = process.argv[2]?.trim();
if (!to || !to.includes("@")) {
  console.error("Usage: bun run email:test you@example.com   (after: set -a; source ~/BellTaxPrep/live.env; set +a)");
  process.exit(1);
}
const cfg = loadEmail(process.env, "live");
if (cfg.driver !== "resend") {
  console.error("No RESEND_API_KEY loaded. Run: set -a; source ~/BellTaxPrep/live.env; set +a");
  process.exit(1);
}
const message = { ...signInChangedEmail(to, null, { practiceName: "Bell Tax", preparerName: "Bell Tax" }, "This is a test of Bell Tax's email"), subject: "Bell Tax email test", template: "test" };
const r = await deliverWithResend(cfg, message);
if (r.sent) console.log(`✔ sent to ${to} from ${cfg.from} (Resend id ${r.id}). Check the inbox, and the spam folder.`);
else {
  console.error(`✖ ${r.error}`);
  process.exitCode = 1;
}
