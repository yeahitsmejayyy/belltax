import { runtime } from "../db/client";
import { appendEvent } from "../events";

// Outgoing email (ticket 51). One small interface, two drivers:
//   resend: live mode with RESEND_API_KEY + EMAIL_FROM. A single REST call; no SDK.
//   outbox: everywhere else (dev, tests, both demos). Nothing leaves the machine: messages are kept in memory for the
//           admin's Outbox page and printed to the console.
// Every send is an event (who it went to and which template), never the body or a link.

export type Message = { to: string; subject: string; text: string; html: string; template: string };
export type SendResult = { sent: true; id: string | null; driver: "resend" | "outbox" } | { sent: false; error: string };
export type OutboxEntry = { id: string; at: string; to: string; from: string; subject: string; text: string; html: string; template: string };

const OUTBOX_LIMIT = 50;
const outbox: OutboxEntry[] = [];
export const outboxMessages = (): readonly OutboxEntry[] => outbox;
export const clearOutbox = () => void outbox.splice(0);

// Overridable in tests, so no test ever calls Resend.
export const emailHttp = { fetch: (url: string, init: RequestInit) => fetch(url, init) };

export async function send(m: Message, about: { userId?: string | null; householdId?: string | null } = {}): Promise<SendResult> {
  const { db, email } = runtime();
  const cfg = email ?? { driver: "outbox" as const, from: "Bell Tax <hello@belltax.example>" };
  let result: SendResult;
  if (cfg.driver === "resend") {
    try {
      const res = await emailHttp.fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: cfg.from, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      result = res.ok ? { sent: true, id: body.id ?? null, driver: "resend" } : { sent: false, error: body.message ?? `Resend answered ${res.status}` };
    } catch (e) {
      result = { sent: false, error: (e as Error).message };
    }
  } else {
    const entry = { id: Bun.randomUUIDv7(), at: new Date().toISOString(), to: m.to, from: cfg.from, subject: m.subject, text: m.text, html: m.html, template: m.template };
    outbox.unshift(entry);
    outbox.splice(OUTBOX_LIMIT);
    if (process.env.NODE_ENV !== "test") console.log(`✉  outbox · ${m.template} → ${m.to} · ${m.subject}`);
    result = { sent: true, id: entry.id, driver: "outbox" };
  }
  appendEvent(db, {
    actor: "system",
    type: result.sent ? "email.sent" : "email.failed",
    subjectType: "user",
    subjectId: about.userId ?? "unknown",
    householdId: about.householdId ?? null,
    data: { to: m.to, template: m.template, driver: cfg.driver, ...(result.sent ? {} : { error: result.error.slice(0, 200) }) },
  });
  return result;
}
