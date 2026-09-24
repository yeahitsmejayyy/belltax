import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { DocumentView, EngagementDetail, RequestView } from "@app/schema";
import { z } from "zod";
import { demoWorld } from "./test-harness";

// The preparer's side: one return in full, moving it through the pipeline, asking for things, reviewing uploads.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const detail = async (engagementId: string) => EngagementDetail.parse((await w.call(P(), "engagement.detail", { engagementId })).data);
const advance = (engagementId: string, to: string, reason?: string) => w.call(P(), "engagement.advanceStage", { engagementId, to, reason }, "mutation");
const engIn = (stage: string, extra = "") =>
  w.get<{ id: string }>(`SELECT id FROM engagements WHERE stage = ? AND tax_year = 2025 AND kind = 'original' ${extra} ORDER BY id LIMIT 1`, stage).id;
const primaryUser = (engagementId: string) =>
  w.get<{ id: string }>(
    "SELECT u.id FROM return_people rp JOIN users u ON u.person_id = rp.person_id WHERE rp.engagement_id = ? AND rp.role = 'primary'",
    engagementId,
  ).id;

describe("engagement.detail", () => {
  test("every seeded return produces a valid detail view", async () => {
    const ids = w.all<{ id: string }>("SELECT id FROM engagements");
    for (const { id } of ids) {
      const res = await w.call(P(), "engagement.detail", { engagementId: id });
      expect({ id, ok: EngagementDetail.safeParse(res.data).success }).toEqual({ id, ok: true });
    }
  });

  test("a family's return at the documents stage, in full", async () => {
    const id = w.get<{ engagement_id: string }>("SELECT engagement_id FROM documents WHERE status = 'rejected'").engagement_id;
    const d = await detail(id);
    expect(d.stage).toBe("documents");
    expect(d.people.map((p) => p.role)).toEqual(["primary", "spouse", "dependent", "dependent"]);
    expect(d.people.every((p) => p.ssnLast4 === null || /^\d{4}$/.test(p.ssnLast4))).toBe(true);
    expect(d.people.filter((p) => p.role === "dependent").every((p) => p.relationship && p.monthsLivedWith === 12)).toBe(true);
    expect(d.requests.some((r) => r.latestDocument?.status === "rejected")).toBe(true);
    expect(d.documents.length).toBeGreaterThan(0);
    expect(d.letter).toMatchObject({ status: "draft", sentAt: null });
    expect(d.letter!.signers.every((s) => s.signedAt === null)).toBe(true);
    expect(d.invoices).toEqual([]);
    expect(d.nextStage).toBe("ready");
    expect(d.blockers.join(" ")).toMatch(/document requests? (is|are) still open/);
    const times = d.timeline.map((t) => t.occurredAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(d.timeline.some((t) => t.actorKind === "client" && t.actorName !== "Client")).toBe(true);
  });

  test("a filed return shows its invoice, lines and payments", async () => {
    const id = w.get<{ engagement_id: string }>(
      "SELECT b.engagement_id FROM invoice_balances b WHERE b.settlement = 'failed_last_attempt'",
    ).engagement_id;
    const d = await detail(id);
    expect(d.invoices).toHaveLength(1);
    const inv = d.invoices[0]!;
    expect(inv.settlement).toBe("failed_last_attempt");
    expect(inv.lines.reduce((sum, l) => sum + l.quantity * l.unitAmountCents, 0)).toBe(inv.totalCents);
    expect(inv.payments[0]).toMatchObject({ status: "failed", failureMessage: "Your card was declined." });
    expect(d.nextStage).toBe("complete");
    expect(d.blockers.join(" ")).toMatch(/is still owed/); // a declined card leaves the whole balance due
  });

  test("clients can't open the preparer's view", async () => {
    const id = engIn("documents");
    expect((await w.call(primaryUser(id), "engagement.detail", { engagementId: id })).status).toBe(403);
  });
});

describe("engagement.advanceStage", () => {
  test("documents → ready is blocked until every document request is closed", async () => {
    const id = w.get<{ engagement_id: string }>("SELECT engagement_id FROM documents WHERE status = 'rejected'").engagement_id;
    const blocked = await advance(id, "ready");
    expect(blocked.status).toBe(412);
    expect(blocked.error!.message).toMatch(/still open/);

    // Accept what's waiting for review, cancel what never came, then it moves.
    const d = await detail(id);
    for (const doc of d.documents.filter((x) => x.status === "uploaded" && x.requestId)) {
      expect((await w.call(P(), "document.review", { documentId: doc.id, decision: "accept" }, "mutation")).status).toBe(200);
    }
    const stillOpen = (await detail(id)).requests.filter((r) => r.kind === "document" && r.status === "open");
    for (const r of stillOpen) {
      expect((await w.call(P(), "request.cancel", { requestId: r.id, reason: "Not needed this year" }, "mutation")).status).toBe(200);
    }
    const moved = await advance(id, "ready");
    expect(moved.status).toBe(200);
    expect((await detail(id)).stage).toBe("ready");
    expect(JSON.parse(w.eventsOf("engagement.stage_changed", id).at(-1)!.data)).toEqual({ from: "documents", to: "ready" });
  });

  test("ready → preparing is blocked until every filer signs", async () => {
    const id = engIn("ready", "AND filing_status = 'mfj'");
    const res = await advance(id, "preparing");
    expect(res.status).toBe(412);
    expect(res.error!.message).toMatch(/(hasn't|haven't) signed the engagement letter/);
  });

  test("a joint filing status needs a spouse on the return", async () => {
    const id = engIn("ready", "AND filing_status = 'single'");
    expect((await w.call(P(), "engagement.setFilingStatus", { engagementId: id, filingStatus: "mfj" }, "mutation")).status).toBe(200);
    expect(w.eventsOf("engagement.filing_status_set", id)).toHaveLength(1);
    expect((await detail(id)).blockers).toContain("A joint return needs a spouse on it.");
    await w.call(P(), "engagement.setFilingStatus", { engagementId: id, filingStatus: "single" }, "mutation");
  });

  test("filed → complete is blocked while money is owed", async () => {
    const id = w.get<{ engagement_id: string }>("SELECT engagement_id FROM invoice_balances WHERE settlement = 'partial'").engagement_id;
    const res = await advance(id, "complete");
    expect(res.status).toBe(412);
    expect(res.error!.message).toMatch(/\$\d+\.\d{2} is still owed/);
  });

  test("intake → documents waits for the submitted questionnaire", async () => {
    const id = engIn("intake", "AND id NOT IN (SELECT engagement_id FROM intake_responses WHERE submitted_at IS NOT NULL)");
    const res = await advance(id, "documents");
    expect(res.status).toBe(412);
    expect(res.error!.message).toMatch(/hasn't submitted the questionnaire/);
  });

  test("invited → intake passes once someone can sign in", async () => {
    expect((await advance(engIn("invited"), "intake")).status).toBe(200);
  });

  test("one stage at a time forward; backward only with a reason", async () => {
    const id = engIn("preparing");
    expect((await advance(id, "filed")).error!.message).toMatch(/one stage at a time/);
    expect((await advance(id, "preparing")).status).toBe(400);
    expect((await advance(id, "ready")).error!.message).toMatch(/Say why/);
    const back = await advance(id, "ready", "Client sent a corrected W-2");
    expect(back.status).toBe(200);
    expect(w.eventsOf("engagement.stage_changed", id).at(-1)!.reason).toBe("Client sent a corrected W-2");
  });

  test("clients can't move returns", async () => {
    const id = engIn("preparing");
    expect((await w.call(primaryUser(id), "engagement.advanceStage", { engagementId: id, to: "review" }, "mutation")).status).toBe(403);
  });
});

describe("requests from the preparer", () => {
  const eng = () => engIn("documents", "AND filing_status = 'hoh'");

  test("a document request gets a plain default title and shows up for the client", async () => {
    const id = eng();
    const res = await w.call(P(), "request.create", { engagementId: id, kind: "document", documentKind: "1098_t" }, "mutation");
    const created = RequestView.parse(res.data);
    expect(created).toMatchObject({ title: "Upload your Form 1098-T", status: "open", documentKind: "1098_t" });
    expect(w.eventsOf("request.created", created.id)).toHaveLength(1);
    const clientSees = z.array(RequestView).parse((await w.call(primaryUser(id), "request.list", { engagementId: id })).data);
    expect(clientSees.map((r) => r.id)).toContain(created.id);
  });

  test("questions need a title; bad kinds, people and sources are refused", async () => {
    const id = eng();
    const other = engIn("documents", "AND filing_status = 'mfj'");
    const stranger = w.get<{ person_id: string }>("SELECT person_id FROM return_people WHERE engagement_id = ? AND role = 'primary'", other).person_id;
    const strangerSource = w.get<{ source_id: string }>("SELECT source_id FROM return_sources WHERE engagement_id = ? LIMIT 1", other).source_id;
    expect((await w.call(P(), "request.create", { engagementId: id, kind: "question" }, "mutation")).status).toBe(400);
    expect((await w.call(P(), "request.create", { engagementId: id, kind: "document", documentKind: "w-2" }, "mutation")).status).toBe(400);
    expect((await w.call(P(), "request.create", { engagementId: id, kind: "document", documentKind: "not_a_form" }, "mutation")).error!.message).toMatch(/Unknown document kind/);
    expect((await w.call(P(), "request.create", { engagementId: id, kind: "document", documentKind: "w2", personId: stranger }, "mutation")).error!.message).toMatch(/isn't on this return/);
    expect((await w.call(P(), "request.create", { engagementId: id, kind: "document", documentKind: "w2", sourceId: strangerSource }, "mutation")).error!.message).toMatch(/source isn't on this return/);
    const q = await w.call(P(), "request.create", { engagementId: id, kind: "question", title: "Did your address change?" }, "mutation");
    expect(RequestView.parse(q.data)).toMatchObject({ kind: "question", documentKind: null });
  });

  test("cancelling needs a reason and happens once", async () => {
    const id = eng();
    const r = RequestView.parse((await w.call(P(), "request.create", { engagementId: id, kind: "document", documentKind: "1099_int" }, "mutation")).data);
    expect((await w.call(P(), "request.cancel", { requestId: r.id }, "mutation")).status).toBe(400);
    expect((await w.call(P(), "request.cancel", { requestId: r.id, reason: "Account closed in 2024" }, "mutation")).status).toBe(200);
    expect((await w.call(P(), "request.cancel", { requestId: r.id, reason: "again" }, "mutation")).status).toBe(412);
    expect(w.eventsOf("request.cancelled", r.id)[0]!.reason).toBe("Account closed in 2024");
  });

  test("clients can't create or cancel requests", async () => {
    const id = eng();
    expect((await w.call(primaryUser(id), "request.create", { engagementId: id, kind: "question", title: "hi" }, "mutation")).status).toBe(403);
  });
});

describe("document.review", () => {
  const waiting = () =>
    w.get<{ id: string; engagement_id: string; request_id: string }>(
      "SELECT id, engagement_id, request_id FROM documents WHERE status = 'uploaded' AND request_id IS NOT NULL AND purged_at IS NULL ORDER BY id LIMIT 1",
    );

  test("accepting fulfils the request", async () => {
    const doc = waiting();
    const res = await w.call(P(), "document.review", { documentId: doc.id, decision: "accept" }, "mutation");
    expect(DocumentView.parse(res.data).status).toBe("accepted");
    expect(w.get<{ status: string }>("SELECT status FROM requests WHERE id = ?", doc.request_id).status).toBe("fulfilled");
    expect(w.eventsOf("document.accepted", doc.id)).toHaveLength(1);
    expect((await w.call(P(), "document.review", { documentId: doc.id, decision: "reject", reason: "changed my mind" }, "mutation")).status).toBe(412);
  });

  test("rejecting needs a reason, keeps the request open, and the client reads the reason", async () => {
    const doc = waiting();
    expect((await w.call(P(), "document.review", { documentId: doc.id, decision: "reject" }, "mutation")).status).toBe(400);
    const res = await w.call(P(), "document.review", { documentId: doc.id, decision: "reject", reason: "Page 2 is missing" }, "mutation");
    expect(DocumentView.parse(res.data)).toMatchObject({ status: "rejected", rejectReason: "Page 2 is missing" });
    expect(w.get<{ status: string }>("SELECT status FROM requests WHERE id = ?", doc.request_id).status).toBe("open");
    const client = primaryUser(doc.engagement_id);
    const list = z.array(RequestView).parse((await w.call(client, "request.list", { engagementId: doc.engagement_id })).data);
    expect(list.find((r) => r.id === doc.request_id)!.latestDocument).toMatchObject({ status: "rejected", rejectReason: "Page 2 is missing" });
  });

  test("clients can't review", async () => {
    const doc = waiting();
    expect((await w.call(primaryUser(doc.engagement_id), "document.review", { documentId: doc.id, decision: "accept" }, "mutation")).status).toBe(403);
  });
});
