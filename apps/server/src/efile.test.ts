import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { EfileState, EngagementDetail, EngagementList, Inbox } from "@app/schema";
import { z } from "zod";
import { demoWorld } from "./test-harness";

// Ticket 40: e-file status, recorded by hand from ProSeries. Filed submits federal and state; the IRS and the
// FTB accept or reject; a rejection is fixed and submitted again; Complete waits for both acceptances.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const m = (path: string, input: unknown) => w.call(P(), path, input, "mutation");
const record = async (engagementId: string, jurisdiction: "federal" | "state", action: "submit" | "accept" | "reject", extra: Record<string, string> = {}) => {
  const res = await m("engagement.recordEfile", { engagementId, jurisdiction, action, ...extra });
  return { status: res.status, message: res.error?.message, states: res.status === 200 ? z.array(EfileState).parse(res.data) : null };
};
const inbox = async () => Inbox.parse((await w.call(P(), "inbox.list", { taxYear: 2025 })).data);
const blockers = async (id: string) => (await m("engagement.advanceStage", { engagementId: id, to: "complete" })).error?.message ?? "";

// The first return still in Client review: each describe moves one on, so the next takes the next.
function reviewReturn() {
  return w.get<{ id: string }>("SELECT e.id FROM engagements e WHERE e.tax_year = 2025 AND e.stage = 'review' ORDER BY e.id LIMIT 1").id;
}
// Pay whatever it owes, so the e-file is the only thing between it and Complete.
async function payUp(id: string) {
  for (const b of w.all<{ invoice_id: string; balance_cents: number }>("SELECT invoice_id, balance_cents FROM invoice_balances WHERE engagement_id = ? AND status = 'issued' AND balance_cents > 0", id)) {
    await m("payment.record", { invoiceId: b.invoice_id, amountCents: b.balance_cents, method: "check", receivedOn: "2026-09-23" });
  }
}

describe("filing submits; Complete waits for both acceptances", () => {
  let id: string;

  test("moving to Filed records a submission to the IRS and one to the FTB", async () => {
    id = reviewReturn();
    await payUp(id);
    expect((await m("engagement.advanceStage", { engagementId: id, to: "filed" })).status).toBe(200);
    const detail = EngagementDetail.parse((await w.call(P(), "engagement.detail", { engagementId: id })).data);
    expect(detail.efile.map((s) => [s.jurisdiction, s.status, s.attempts])).toEqual([["federal", "submitted", 1], ["state", "submitted", 1]]);
    expect(w.all("SELECT 1 FROM events WHERE type = 'efile.submitted' AND engagement_id = ?", id)).toHaveLength(2);
  });

  test("Complete is blocked, in plain words, until both are accepted", async () => {
    expect(await blockers(id)).toContain("Waiting on the IRS to accept the federal return.");
    expect(await blockers(id)).toContain("Waiting on the FTB to accept the state return.");
    await record(id, "federal", "accept");
    const now = await blockers(id);
    expect(now).not.toContain("federal");
    expect(now).toContain("Waiting on the FTB");
    await record(id, "state", "accept");
    expect((await m("engagement.advanceStage", { engagementId: id, to: "complete" })).status).toBe(200);
    expect(w.all("SELECT 1 FROM events WHERE type = 'efile.accepted' AND engagement_id = ?", id)).toHaveLength(2);
  });
});

describe("a rejection", () => {
  let id: string;

  test("needs its code and what it means", async () => {
    id = reviewReturn();
    await m("engagement.advanceStage", { engagementId: id, to: "filed" });
    expect((await record(id, "federal", "reject")).status).toBe(400);
    expect((await record(id, "federal", "reject", { rejectionCode: "IND-181-01" })).status).toBe(400);
    const res = await record(id, "federal", "reject", { rejectionCode: "IND-181-01", reason: "The IP PIN is missing or doesn't match." });
    expect(res.states![0]).toMatchObject({ status: "rejected", rejectionCode: "IND-181-01", rejectionNote: "The IP PIN is missing or doesn't match." });
    const ev = w.get<{ reason: string; data: string }>("SELECT reason, data FROM events WHERE type = 'efile.rejected' AND engagement_id = ?", id);
    expect(ev.reason).toBe("The IP PIN is missing or doesn't match.");
    expect(JSON.parse(ev.data)).toEqual({ jurisdiction: "federal", code: "IND-181-01" });
  });

  test("shows up in the Inbox as its own kind, and blocks Complete naming the code", async () => {
    const item = (await inbox()).items.find((i) => i.kind === "efile_rejected" && i.engagementId === id)!;
    expect(item).toMatchObject({ action: "resubmit_efile", who: "IRS" });
    expect(item.summary).toMatch(/^The IRS rejected .+'s federal return \(IND-181-01\)\.$/);
    expect(await blockers(id)).toContain("The IRS rejected the federal return (IND-181-01). Fix it in ProSeries and submit it again.");
  });

  test("resubmitting starts a new attempt and clears the Inbox item; the history stays", async () => {
    const res = await record(id, "federal", "submit");
    expect(res.states![0]).toMatchObject({ status: "submitted", attempts: 2, rejectionCode: null });
    expect((await inbox()).items.some((i) => i.kind === "efile_rejected" && i.engagementId === id)).toBe(false);
    expect(JSON.parse(w.all<{ data: string }>("SELECT data FROM events WHERE type = 'efile.submitted' AND engagement_id = ? ORDER BY occurred_at, id", id).at(-1)!.data)).toEqual({ jurisdiction: "federal", resubmission: true });
    expect(w.all("SELECT 1 FROM efile_submissions WHERE engagement_id = ? AND jurisdiction = 'federal'", id)).toHaveLength(2);
  });
});

describe("what can't happen", () => {
  test("out of order: no answer without a waiting e-file, no second one while waiting, only in Filed", async () => {
    const id = reviewReturn();
    expect(await record(id, "federal", "submit")).toMatchObject({ status: 412, message: "E-file status is recorded while the return is in Filed." });
    await m("engagement.advanceStage", { engagementId: id, to: "filed" });
    expect(await record(id, "state", "submit")).toMatchObject({ status: 412, message: "The state return is already waiting on the FTB." });
    await record(id, "state", "accept");
    expect(await record(id, "state", "accept")).toMatchObject({ status: 412, message: "There's no state e-file waiting on the FTB to answer." });
    expect(await record(id, "state", "submit")).toMatchObject({ status: 412, message: "The FTB already accepted the state return." });
  });

  test("the database holds it too: answered once, never deleted, one waiting at a time", () => {
    const answered = w.get<{ id: string }>("SELECT id FROM efile_submissions WHERE status = 'accepted' LIMIT 1").id;
    expect(() => w.db.run("UPDATE efile_submissions SET status = 'rejected', rejection_code = 'X', rejection_note = 'xyz' WHERE id = ?", [answered])).toThrow(/answered once/);
    expect(() => w.db.run("DELETE FROM efile_submissions WHERE id = ?", [answered])).toThrow(/never deleted/);
    const waiting = w.get<{ engagement_id: string; jurisdiction: string }>("SELECT engagement_id, jurisdiction FROM efile_submissions WHERE status = 'submitted' LIMIT 1");
    expect(() =>
      w.db.run("INSERT INTO efile_submissions (id, engagement_id, jurisdiction, submitted_at) VALUES (?, ?, ?, ?)", [Bun.randomUUIDv7(), waiting.engagement_id, waiting.jurisdiction, "2026-09-23T00:00:00.000Z"]),
    ).toThrow(/already has an e-file waiting/);
  });
});

describe("where it shows", () => {
  test("the pipeline carries each return's status per jurisdiction", async () => {
    const list = EngagementList.parse((await w.call(P(), "engagement.list", { taxYear: 2025 })).data);
    for (const r of list.rows) {
      const latest = (j: string) =>
        (w.get<{ status: "submitted" | "accepted" | "rejected" } | null>("SELECT status FROM efile_submissions WHERE engagement_id = ? AND jurisdiction = ? ORDER BY submitted_at DESC, id DESC LIMIT 1", r.engagementId, j)?.status ?? null);
      expect({ id: r.engagementId, efile: r.efile }).toEqual({ id: r.engagementId, efile: { federal: latest("federal"), state: latest("state") } });
    }
    expect(list.rows.some((r) => r.efile.federal === "rejected")).toBe(true); // the seed has one
  });

  test("a client never sees rejection codes: just that it's filed", async () => {
    const rejected = w.get<{ engagement_id: string }>("SELECT engagement_id FROM efile_submissions WHERE status = 'rejected' AND rejection_code = 'IND-031-04'").engagement_id;
    const client = w.get<{ id: string }>("SELECT u.id FROM return_people rp JOIN users u ON u.person_id = rp.person_id WHERE rp.engagement_id = ? AND rp.role = 'primary'", rejected).id;
    const mine = await w.call(client, "engagement.mine", undefined, "query", "portal");
    const text = JSON.stringify(mine.data);
    expect(text).toContain('"stage":"filed"');
    expect(text).not.toContain("IND-031-04");
    expect(text).not.toContain("rejected");
    expect((await w.call(client, "engagement.recordEfile", { engagementId: rejected, jurisdiction: "federal", action: "submit" }, "mutation", "portal")).status).toBe(404);
    expect((await w.call(client, "engagement.detail", { engagementId: rejected }, "query", "portal")).status).toBe(404);
  });
});
