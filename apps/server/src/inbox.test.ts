import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { ActivityPage, Inbox, now } from "@app/schema";
import { demoWorld } from "./test-harness";

// The admin Inbox (derived triage) and Activity feed (the whole audit trail), on the demo world.

let w: Awaited<ReturnType<typeof demoWorld>>;
let staleId: string;
beforeAll(async () => {
  w = await demoWorld();
  // One return that's been sitting for a month, so the stale kind has something to show.
  staleId = w.get<{ id: string }>("SELECT id FROM engagements WHERE stage = 'intake' AND tax_year = 2025 ORDER BY id LIMIT 1").id;
  w.db.run("UPDATE engagements SET stage_changed_at = ? WHERE id = ?", [new Date(Date.now() - 30 * 86_400_000).toISOString(), staleId]);
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const inbox = async (input?: unknown) => Inbox.parse((await w.call(P(), "inbox.list", input)).data);
const activity = async (input?: unknown) => ActivityPage.parse((await w.call(P(), "activity.list", input)).data);
const m = (path: string, input: unknown) => w.call(P(), path, input, "mutation");
const has = (box: Awaited<ReturnType<typeof inbox>>, id: string) => box.items.some((i) => i.id === id);

describe("inbox.list", () => {
  test("every kind appears for the seeded world, counted, newest first", async () => {
    const box = await inbox();
    expect(box.taxYear).toBe(2025);
    for (const kind of ["document_review", "question_answered", "letter_signed", "payment_failed", "stale"] as const) {
      expect({ kind, n: box.counts[kind] > 0 }).toEqual({ kind, n: true });
      expect(box.items.filter((i) => i.kind === kind)).toHaveLength(box.counts[kind]);
    }
    expect(box.total).toBe(box.items.length);
    const ats = box.items.map((i) => i.at);
    expect(ats).toEqual([...ats].sort().reverse());
    expect(box.items.every((i) => i.summary.length > 10 && i.taxYear === 2025)).toBe(true);
  });

  test("a reviewed upload leaves the inbox", async () => {
    const item = (await inbox()).items.find((i) => i.kind === "document_review")!;
    await m("document.review", { documentId: item.subjectId, decision: "accept" });
    expect(has(await inbox(), item.id)).toBe(false);
  });

  test("an acknowledged answer leaves the inbox; acknowledging needs an answer", async () => {
    const item = (await inbox()).items.find((i) => i.kind === "question_answered")!;
    expect(item.summary).toMatch(/answered "/);
    expect((await m("request.acknowledge", { requestId: item.subjectId })).status).toBe(200);
    expect(has(await inbox(), item.id)).toBe(false);
    expect(w.eventsOf("request.acknowledged", item.subjectId)).toHaveLength(1);

    const eng = item.engagementId;
    const q = (await m("request.create", { engagementId: eng, kind: "question", title: "Any new dependents?" })).data as { id: string };
    expect((await m("request.acknowledge", { requestId: q.id })).error!.message).toMatch(/no answer/);
  });

  test("a signed letter leaves the inbox once the return moves on", async () => {
    const item = (await inbox()).items.find((i) => i.kind === "letter_signed")!;
    expect((await m("engagement.advanceStage", { engagementId: item.engagementId, to: "preparing" })).status).toBe(200);
    expect(has(await inbox(), item.id)).toBe(false);
  });

  test("a failed payment leaves the inbox once it's paid", async () => {
    const item = (await inbox()).items.find((i) => i.kind === "payment_failed")!;
    expect(item.summary).toMatch(/declined/);
    const invoice = w.get<{ invoice_id: string; balance_cents: number }>("SELECT b.invoice_id, b.balance_cents FROM invoice_balances b WHERE b.engagement_id = ? AND b.status = 'issued'", item.engagementId);
    await m("payment.record", { invoiceId: invoice.invoice_id, amountCents: invoice.balance_cents, method: "check", receivedOn: now().slice(0, 10) });
    expect(has(await inbox(), item.id)).toBe(false);
  });

  test("a stale return leaves the inbox once it moves; the threshold is adjustable", async () => {
    const item = (await inbox()).items.find((i) => i.kind === "stale" && i.engagementId === staleId)!;
    expect(item.summary).toMatch(/has been in intake for 30 days/);
    expect((await inbox({ staleDays: 60 })).items.some((i) => i.id === item.id)).toBe(false);
    await m("engagement.advanceStage", { engagementId: item.engagementId, to: "invited", reason: "Waiting on the client to sign in" });
    expect(has(await inbox(), item.id)).toBe(false);
  });

  test("filters by tax year", async () => {
    const last = await inbox({ taxYear: 2024 });
    expect(last.items.every((i) => i.taxYear === 2024)).toBe(true);
  });
});

describe("activity.list", () => {
  test("pages through everything newest first, with no gaps or repeats", async () => {
    const total = w.get<{ n: number }>("SELECT COUNT(*) AS n FROM events").n;
    const seen: string[] = [];
    let cursor: unknown;
    for (let guard = 0; guard < 1000; guard++) {
      const page = await activity({ limit: 37, cursor });
      seen.push(...page.items.map((i) => `${i.occurredAt}|${i.id}`));
      if (!page.next) break;
      cursor = page.next;
    }
    expect(seen.length).toBe(total);
    expect(new Set(seen).size).toBe(total);
    expect(seen).toEqual([...seen].sort().reverse());
  });

  test("pages stay stable while new events arrive", async () => {
    const first = await activity({ limit: 10 });
    await m("household.create", { displayName: "Arrives mid-read" }); // a new newest event
    const second = await activity({ limit: 10, cursor: first.next! });
    const all = await activity({ limit: 25 });
    // Page two picks up exactly where page one stopped, unaffected by the new event on top.
    const idx = all.items.findIndex((i) => i.id === first.items.at(-1)!.id);
    expect(second.items.map((i) => i.id)).toEqual(all.items.slice(idx + 1, idx + 11).map((i) => i.id));
  });

  test("filters by actor, type, household and date range", async () => {
    const stripe = await activity({ actorKind: "stripe", limit: 200 });
    expect(stripe.items.length).toBeGreaterThan(0);
    expect(stripe.items.every((i) => i.actorKind === "stripe" && i.actorName === "Stripe")).toBe(true);

    const docs = await activity({ typePrefix: "document.", limit: 200 });
    expect(docs.items.every((i) => i.type.startsWith("document."))).toBe(true);

    const hh = w.get<{ household_id: string }>("SELECT household_id FROM events WHERE household_id IS NOT NULL LIMIT 1").household_id;
    const one = await activity({ householdId: hh, limit: 200 });
    expect(one.items.every((i) => i.householdId === hh && i.householdName)).toBe(true);

    const from = "2026-09-01T00:00:00.000Z";
    const to = "2026-09-15T00:00:00.000Z";
    const window = await activity({ from, to, limit: 200 });
    expect(window.items.every((i) => i.occurredAt >= from && i.occurredAt < to)).toBe(true);

    expect((await w.call(P(), "activity.list", { typePrefix: "DROP TABLE" })).status).toBe(400);
  });

  test("each event names who did it", async () => {
    const client = await activity({ actorKind: "client", limit: 20 });
    expect(client.items.length).toBeGreaterThan(0);
    expect(client.items.every((i) => /^\S+ \S+/.test(i.actorName))).toBe(true); // a person's full name
    const system = await activity({ actorKind: "preparer", limit: 5 });
    expect(system.items.every((i) => i.actorName === "Preparer")).toBe(true);
  });
});

describe("authorization", () => {
  test("404 on the portal, 403 for a client on the admin", async () => {
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    for (const path of ["inbox.list", "activity.list"]) {
      expect((await w.call(P(), path, undefined, "query", "portal")).status).toBe(404);
      expect((await w.call(client, path, undefined, "query", "admin")).status).toBe(403);
    }
    expect((await w.call(client, "request.acknowledge", { requestId: client }, "mutation", "admin")).status).toBe(403);
  });
});
