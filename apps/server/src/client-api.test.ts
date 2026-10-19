import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DocumentView, IntakeView, MyEngagement, now, RequestView, UPLOAD_MAX_BYTES } from "@app/schema";
import { z } from "zod";
import { useRuntime } from "./db/client";
import { applySchema } from "./db/schema";
import { demoPdf } from "./db/seed/pdf";
import { seedDemo } from "./db/seed/seed";
import { createFetchHandler } from "./http";
import { DEMO_USER_HEADER } from "./identity";
import { createStorage } from "./storage";

// Client-side API over HTTP against the seeded demo world, through the portal listener where clients
// actually are. Authorization first: a client must never reach another household's data, and a denial
// must look exactly like "doesn't exist".

const tmp = mkdtempSync(join(tmpdir(), "btp-client-"));
const storage = createStorage(join(tmp, "files"));
const handler = createFetchHandler({ surface: "portal", webDist: join(tmp, "dist") });
const adminHandler = createFetchHandler({ surface: "admin", webDist: join(tmp, "dist") });
const ORIGIN = "http://127.0.0.1";
let db: Database;

type Who = { userId: string; engagementId: string; householdId: string };
let alice: Who; // mfj_kids household at the documents stage, with a rejected upload
let bob: Who; // a different household
let preparerId: string;
let rejectedRequestId: string;

const q = <T>(sql: string, ...p: string[]) => db.query(sql).get(...p) as T;

beforeAll(async () => {
  db = new Database(":memory:", { strict: true });
  await applySchema(db);
  seedDemo(db, { storage, anchor: new Date("2026-09-23T17:00:00.000Z") });
  useRuntime({ db, storage, mode: "demo" });
  preparerId = q<{ id: string }>("SELECT id FROM users WHERE role = 'preparer'").id;

  const rejected = q<{ request_id: string; engagement_id: string }>("SELECT request_id, engagement_id FROM documents WHERE status = 'rejected'");
  rejectedRequestId = rejected.request_id;
  const whoOn = (engagementId: string) =>
    q<Who>(
      `SELECT u.id AS userId, e.id AS engagementId, e.household_id AS householdId
         FROM engagements e JOIN return_people rp ON rp.engagement_id = e.id AND rp.role = 'primary'
         JOIN users u ON u.person_id = rp.person_id WHERE e.id = ?`,
      engagementId,
    );
  alice = whoOn(rejected.engagement_id);
  const other = q<{ id: string }>(
    "SELECT id FROM engagements WHERE household_id <> ? AND tax_year = 2025 AND stage = 'documents' AND kind = 'original' ORDER BY id LIMIT 1",
    alice.householdId,
  );
  bob = whoOn(other.id);
});
beforeEach(() => useRuntime({ db, storage, mode: "demo" }));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

// ---- tiny tRPC-over-fetch client ----
type Res = { status: number; data?: unknown; error?: { message: string } };
async function call(as: string | null, path: string, input: unknown, kind: "query" | "mutation" = "query"): Promise<Res> {
  const headers: Record<string, string> = as ? { [DEMO_USER_HEADER]: as } : {};
  const url = `${ORIGIN}/trpc/${path}`;
  const res =
    kind === "query"
      ? await handler(new Request(`${url}?input=${encodeURIComponent(JSON.stringify(input))}`, { headers }))
      : await handler(new Request(url, { method: "POST", headers: { ...headers, "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify(input) }));
  const body = (await res.json()) as { result?: { data: unknown }; error?: { message: string } };
  return { status: res.status, data: body.result?.data, error: body.error };
}
async function upload(as: string, fields: Record<string, string>, bytes: Uint8Array, origin = ORIGIN) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  form.set("file", new File([bytes], "scan.pdf", { type: "application/pdf" }));
  const res = await handler(new Request(`${ORIGIN}/api/documents`, { method: "POST", headers: { [DEMO_USER_HEADER]: as, origin }, body: form }));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}
const download = (as: string, id: string) => handler(new Request(`${ORIGIN}/api/documents/${id}/file`, { headers: { [DEMO_USER_HEADER]: as } }));
const pdf = () => demoPdf(["test upload"]);
const eventCount = (type: string) => q<{ n: number }>("SELECT COUNT(*) AS n FROM events WHERE type = ?", type).n;

describe("authorization: a client never reaches another household", () => {
  test("every read of someone else's return is NOT_FOUND", async () => {
    for (const path of ["intake.get", "request.list", "document.list"]) {
      const res = await call(bob.userId, path, { engagementId: alice.engagementId });
      expect({ path, status: res.status }).toEqual({ path, status: 404 });
    }
  });

  test("…and looks exactly like a return that doesn't exist", async () => {
    const theirs = await call(bob.userId, "intake.get", { engagementId: alice.engagementId });
    const nobody = await call(bob.userId, "intake.get", { engagementId: "0190a000-0000-7000-8000-0000000000ff" });
    expect(theirs.error!.message).toBe(nobody.error!.message);
  });

  test("writes to someone else's return are NOT_FOUND", async () => {
    expect((await call(bob.userId, "intake.save", { engagementId: alice.engagementId, answers: { moved: true } }, "mutation")).status).toBe(404);
    expect((await upload(bob.userId, { engagementId: alice.engagementId, kind: "w2" }, pdf())).status).toBe(404);
    const aliceDoc = q<{ id: string }>("SELECT id FROM documents WHERE engagement_id = ? AND purged_at IS NULL LIMIT 1", alice.engagementId);
    expect((await call(bob.userId, "document.delete", { documentId: aliceDoc.id }, "mutation")).status).toBe(404);
    expect((await download(bob.userId, aliceDoc.id)).status).toBe(404);
  });

  test("a client can't answer another household's question", async () => {
    const qid = Bun.randomUUIDv7();
    db.run(
      "INSERT INTO requests (id, engagement_id, kind, title, status, created_by, created_at) VALUES (?, ?, 'question', 'Did you move?', 'open', ?, ?)",
      [qid, alice.engagementId, preparerId, now()],
    );
    expect((await call(bob.userId, "request.answer", { requestId: qid, response: "no" }, "mutation")).status).toBe(404);
  });

  test("preparer procedures don't exist on the portal", async () => {
    const res = await call(alice.userId, "engagement.list", undefined);
    expect(res.status).toBe(404);
    expect(res.error!.message).toBe('No procedure found on path "engagement.list"');
  });

  test("a delegate reads a parent's return through a grant, and loses it when revoked", async () => {
    const d = q<{ user_id: string; grant_id: string; engagement_id: string }>(
      `SELECT u.id AS user_id, ha.id AS grant_id, e.id AS engagement_id
         FROM users u JOIN people p ON p.id = u.person_id AND p.household_id IS NULL
         JOIN household_access ha ON ha.user_id = u.id
         JOIN engagements e ON e.household_id = ha.household_id AND e.tax_year = 2025`,
    );
    expect((await call(d.user_id, "request.list", { engagementId: d.engagement_id })).status).toBe(200);
    db.run("UPDATE household_access SET revoked_at = ? WHERE id = ?", [now(), d.grant_id]);
    expect((await call(d.user_id, "request.list", { engagementId: d.engagement_id })).status).toBe(404);
  });

  test("live mode: no identity exists yet, so everything is 401 and the demo header is ignored", async () => {
    useRuntime({ db, storage, mode: "live" });
    expect((await call(alice.userId, "intake.get", { engagementId: alice.engagementId })).status).toBe(401);
    expect((await call(null, "engagement.list", undefined)).status).toBe(404); // not even there on the portal
    expect((await upload(alice.userId, { engagementId: alice.engagementId, kind: "w2" }, pdf())).status).toBe(401);
  });
});

describe("engagement.mine", () => {
  test("a client sees only their own returns, including last season's", async () => {
    const mine = z.array(MyEngagement).parse((await call(alice.userId, "engagement.mine", undefined)).data);
    expect(mine.map((m) => m.engagementId)).toContain(alice.engagementId);
    expect(mine.map((m) => m.engagementId)).not.toContain(bob.engagementId);
    expect(mine.some((m) => m.taxYear === 2024)).toBe(true); // alice's household is returning
    expect(mine.find((m) => m.engagementId === alice.engagementId)!.via).toBe("filer");
  });

  test("when each stage was reached, for the portal's timeline: opened first, then each move, ending where it is", async () => {
    const mine = z.array(MyEngagement).parse((await call(alice.userId, "engagement.mine", undefined)).data);
    const r = mine.find((m) => m.engagementId === alice.engagementId)!;
    expect(r.reached[0]!.stage).toBe("invited");
    expect(r.reached.at(-1)!.stage).toBe(r.stage);
    expect(r.reached.map((x) => x.at)).toEqual([...r.reached.map((x) => x.at)].sort());
  });
});

describe("intake", () => {
  test("an answer the client empties is cleared, not kept at its old value", async () => {
    const eng = q<{ id: string }>("SELECT id FROM engagements WHERE stage = 'intake' AND tax_year = 2025 AND id NOT IN (SELECT engagement_id FROM intake_responses WHERE submitted_at IS NOT NULL) ORDER BY id DESC LIMIT 1");
    const owner = q<{ id: string }>(
      "SELECT u.id FROM return_people rp JOIN users u ON u.person_id = rp.person_id WHERE rp.engagement_id = ? AND rp.role = 'primary'",
      eng.id,
    ).id;
    await call(owner, "intake.save", { engagementId: eng.id, answers: { digital_assets: true } }, "mutation");
    const view = IntakeView.parse((await call(owner, "intake.save", { engagementId: eng.id, answers: {}, clear: ["digital_assets"] }, "mutation")).data);
    expect(view.answers).not.toHaveProperty("digital_assets");
  });

  test("saves merge step by step; submitting locks it for the client, not the preparer", async () => {
    const eng = q<{ id: string }>("SELECT id FROM engagements WHERE stage = 'intake' AND tax_year = 2025 AND id NOT IN (SELECT engagement_id FROM intake_responses WHERE submitted_at IS NOT NULL) LIMIT 1");
    const owner = q<{ id: string }>(
      "SELECT u.id FROM return_people rp JOIN users u ON u.person_id = rp.person_id WHERE rp.engagement_id = ? AND rp.role = 'primary'",
      eng.id,
    ).id;
    const before = eventCount("intake.saved");
    await call(owner, "intake.save", { engagementId: eng.id, answers: { moved: true, moved_where: "within_ca" } }, "mutation");
    const saved = await call(owner, "intake.save", { engagementId: eng.id, answers: { digital_assets: false } }, "mutation");
    const view = IntakeView.parse(saved.data);
    expect(view.answers).toMatchObject({ moved: true, moved_where: "within_ca", digital_assets: false });
    expect(view.missing.length).toBeGreaterThan(0);
    expect(eventCount("intake.saved")).toBe(before + 2);

    // Submitting too early names what's still missing; answering it all then submits.
    const early = await call(owner, "intake.save", { engagementId: eng.id, answers: {}, submit: true }, "mutation");
    expect(early.status).toBe(412);
    expect(early.error!.message).toMatch(/^Still to answer: .*Where did your income come from\?/);
    const rest = {
      marital_changed: false, has_dependents: false, income_types: ["wages"], job_changed: false, sold_home: false,
      tuition: false, student_loan_interest: false, bought_home: false, mortgage_interest: false, coverage_source: "employer",
      covered_all_year: true, prior_preparer: "self", tax_letters: false, estimated_payments: false, has_ip_pin: false, refund_preference: "check",
    };
    const submitted = IntakeView.parse((await call(owner, "intake.save", { engagementId: eng.id, answers: rest, submit: true }, "mutation")).data);
    expect(submitted.missing).toEqual([]);
    expect(submitted.submittedAt).not.toBeNull();
    expect(eventCount("intake.submitted")).toBeGreaterThan(0);
    const again = await call(owner, "intake.save", { engagementId: eng.id, answers: { moved: false } }, "mutation");
    expect(again.status).toBe(412);
    expect(again.error!.message).toMatch(/already submitted/);
    // The preparer corrects it from the admin, which is the only place a preparer identity counts.
    const res = await adminHandler(
      new Request(`${ORIGIN}/trpc/intake.save`, {
        method: "POST",
        headers: { [DEMO_USER_HEADER]: preparerId, "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ engagementId: eng.id, answers: { moved: false } }),
      }),
    );
    const byPreparer = (await res.json()) as { result: { data: unknown } };
    expect(IntakeView.parse(byPreparer.result.data).answers.moved).toBe(false);
  });

  test("oversized, malformed or unknown answers are refused", async () => {
    const save = (answers: unknown) => call(alice.userId, "intake.save", { engagementId: alice.engagementId, answers }, "mutation");
    expect((await save({ questions_for_preparer: "x".repeat(70_000) })).status).toBe(400);
    expect((await save({ new_baby: true })).status).toBe(400);
    expect((await save({ moved: "yes" })).status).toBe(400);
  });
});

describe("requests", () => {
  test("list shows what's asked, with the latest upload and any rejection reason", async () => {
    const res = await call(alice.userId, "request.list", { engagementId: alice.engagementId });
    const list = z.array(RequestView).parse(res.data);
    const rejected = list.find((r) => r.id === rejectedRequestId)!;
    expect(rejected.status).toBe("open");
    expect(rejected.latestDocument?.status).toBe("rejected");
    expect(rejected.latestDocument?.rejectReason).toMatch(/blurry/);
    expect(list[0]!.status).toBe("open"); // open items first
  });

  test("answering a question fulfils it, once", async () => {
    const qid = Bun.randomUUIDv7();
    db.run(
      "INSERT INTO requests (id, engagement_id, kind, title, status, created_by, created_at) VALUES (?, ?, 'question', 'Any new dependents?', 'open', ?, ?)",
      [qid, alice.engagementId, preparerId, now()],
    );
    const before = eventCount("request.answered");
    expect((await call(alice.userId, "request.answer", { requestId: qid, response: "No" }, "mutation")).status).toBe(200);
    expect(q<{ status: string; response: string }>("SELECT status, response FROM requests WHERE id = ?", qid)).toEqual({ status: "fulfilled", response: "No" });
    expect(eventCount("request.answered")).toBe(before + 1);
    expect((await call(alice.userId, "request.answer", { requestId: qid, response: "Yes" }, "mutation")).status).toBe(412);
    expect((await call(alice.userId, "request.answer", { requestId: rejectedRequestId, response: "here" }, "mutation")).status).toBe(400);
  });
});

describe("documents", () => {
  test("re-uploading against a rejected request replaces it, and the preparer can review it", async () => {
    const bytes = pdf();
    const before = eventCount("document.uploaded");
    const res = await upload(alice.userId, { engagementId: alice.engagementId, requestId: rejectedRequestId }, bytes);
    expect(res.status).toBe(201);
    const doc = DocumentView.parse(res.body);
    expect(doc).toMatchObject({ status: "uploaded", mine: true, mimeType: "application/pdf", requestId: rejectedRequestId });
    const row = q<{ supersedes_id: string | null; sha256: string; storage_key: string }>("SELECT supersedes_id, sha256, storage_key FROM documents WHERE id = ?", doc.id);
    expect(row.supersedes_id).not.toBeNull();
    expect(row.sha256).toBe(new Bun.CryptoHasher("sha256").update(bytes).digest("hex"));
    expect(Buffer.from(storage.get(row.storage_key)).equals(Buffer.from(bytes))).toBe(true);
    expect(eventCount("document.uploaded")).toBe(before + 1);
    // The request stays open until the preparer accepts the new copy.
    const list = z.array(RequestView).parse((await call(alice.userId, "request.list", { engagementId: alice.engagementId })).data);
    expect(list.find((r) => r.id === rejectedRequestId)).toMatchObject({ status: "open", latestDocument: { id: doc.id } });
  });

  test("the preparer's download returns the exact bytes, never cached; the client who sent it can't read it back", async () => {
    const up = DocumentView.parse((await upload(alice.userId, { engagementId: alice.engagementId, kind: "other" }, pdf())).body);
    expect((await download(alice.userId, up.id)).status).toBe(404); // send-only portal (ticket 52)
    const res = await adminHandler(new Request(`${ORIGIN}/api/documents/${up.id}/file`, { headers: { [DEMO_USER_HEADER]: preparerId } }));
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).equals(Buffer.from(pdf()))).toBe(true);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("uploads are checked: real file type, size, kind, person, origin", async () => {
    const base = { engagementId: alice.engagementId, kind: "w2" };
    expect((await upload(alice.userId, base, new TextEncoder().encode("<script>alert(1)</script>"))).status).toBe(415);
    expect((await upload(alice.userId, base, new Uint8Array(UPLOAD_MAX_BYTES + 1))).status).toBe(413);
    expect((await upload(alice.userId, { ...base, kind: "not_a_form" }, pdf())).status).toBe(400);
    expect((await upload(alice.userId, { ...base, requestId: rejectedRequestId, kind: "1099_b" }, pdf())).status).toBe(400);
    const stranger = q<{ id: string }>("SELECT person_id AS id FROM return_people WHERE engagement_id = ? AND role = 'primary'", bob.engagementId).id;
    expect((await upload(alice.userId, { ...base, personId: stranger }, pdf())).status).toBe(400);
    expect((await upload(alice.userId, base, pdf(), "https://evil.example")).status).toBe(403);
  });

  test("a client can take back an unreviewed upload of their own, and only that", async () => {
    const up = DocumentView.parse((await upload(alice.userId, { engagementId: alice.engagementId, kind: "other" }, pdf())).body);
    const key = q<{ storage_key: string }>("SELECT storage_key FROM documents WHERE id = ?", up.id).storage_key;
    expect((await call(alice.userId, "document.delete", { documentId: up.id }, "mutation")).status).toBe(200);
    expect(q<{ purged_at: string | null; storage_key: string | null }>("SELECT purged_at, storage_key FROM documents WHERE id = ?", up.id)).toMatchObject({ storage_key: null });
    expect(() => storage.get(key)).toThrow();
    const listed = z.array(DocumentView).parse((await call(alice.userId, "document.list", { engagementId: alice.engagementId })).data);
    expect(listed.find((d) => d.id === up.id)).toBeUndefined();

    // Once the preparer has reviewed it, it's theirs to keep.
    const reviewed = DocumentView.parse((await upload(alice.userId, { engagementId: alice.engagementId, kind: "other" }, pdf())).body);
    db.run("UPDATE documents SET status = 'accepted', reviewed_at = ? WHERE id = ?", [now(), reviewed.id]);
    expect((await call(alice.userId, "document.delete", { documentId: reviewed.id }, "mutation")).status).toBe(412);

    // A spouse on the same return can see the upload but not remove it.
    const spouse = q<{ id: string }>(
      "SELECT u.id FROM return_people rp JOIN users u ON u.person_id = rp.person_id WHERE rp.engagement_id = ? AND rp.role = 'spouse'",
      alice.engagementId,
    ).id;
    const theirs = DocumentView.parse((await upload(spouse, { engagementId: alice.engagementId, kind: "other" }, pdf())).body);
    const seenByAlice = z.array(DocumentView).parse((await call(alice.userId, "document.list", { engagementId: alice.engagementId })).data);
    expect(seenByAlice.find((d) => d.id === theirs.id)).toMatchObject({ mine: false });
    expect((await call(alice.userId, "document.delete", { documentId: theirs.id }, "mutation")).status).toBe(403);
  });

  test("list includes person-level documents like a new client's photo ID", async () => {
    const newClient = q<{ engagement_id: string; user_id: string }>(
      `SELECT rp.engagement_id, u.id AS user_id FROM documents d
         JOIN return_people rp ON rp.person_id = d.person_id AND rp.role = 'primary'
         JOIN engagements e ON e.id = rp.engagement_id AND e.tax_year = 2025
         JOIN users u ON u.person_id = d.person_id
        WHERE d.kind = 'photo_id' LIMIT 1`,
    );
    const docs = z.array(DocumentView).parse((await call(newClient.user_id, "document.list", { engagementId: newClient.engagement_id })).data);
    expect(docs.some((d) => d.kind === "photo_id" && d.engagementId === null)).toBe(true);
  });
});
