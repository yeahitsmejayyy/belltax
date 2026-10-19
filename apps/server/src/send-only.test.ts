import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { DEMO_USER_HEADER } from "./identity";
import { demoWorld, ORIGIN } from "./test-harness";

// Ticket 52: the portal is a mail slot, not a filing cabinet. A taken-over client account sees what was sent and where
// it stands, never the documents or the answers themselves. The preparer still sees everything.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const clientOf = (engagementId: string) =>
  w.get<{ id: string }>("SELECT u.id FROM return_people rp JOIN users u ON u.person_id = rp.person_id WHERE rp.engagement_id = ? AND rp.role = 'primary'", engagementId).id;

describe("documents", () => {
  test("a client can list what they sent but can't download it, on either surface; the preparer can", async () => {
    const doc = w.get<{ id: string; engagement_id: string }>("SELECT id, engagement_id FROM documents WHERE purged_at IS NULL AND engagement_id IS NOT NULL LIMIT 1");
    const client = clientOf(doc.engagement_id);
    const listed = await w.call(client, "document.list", { engagementId: doc.engagement_id }, "query", "portal");
    expect((listed.data as { id: string }[]).map((d) => d.id)).toContain(doc.id);
    for (const app of [w.portal, w.handler]) {
      expect((await app(new Request(`${ORIGIN}/api/documents/${doc.id}/file`, { headers: { [DEMO_USER_HEADER]: client } }))).status).toBe(404);
    }
    expect((await w.handler(new Request(`${ORIGIN}/api/documents/${doc.id}/file`, { headers: { [DEMO_USER_HEADER]: w.preparerId } }))).status).toBe(200);
  });
});

describe("intake answers", () => {
  test("after submitting, the client sees when it was sent, not what they said; the preparer sees the answers", async () => {
    const eng = w.get<{ engagement_id: string }>("SELECT engagement_id FROM intake_responses WHERE submitted_at IS NOT NULL AND answers <> '{}' LIMIT 1").engagement_id;
    const mine = (await w.call(clientOf(eng), "intake.get", { engagementId: eng }, "query", "portal")).data as { answers: object; submittedAt: string | null };
    expect(mine.submittedAt).not.toBeNull();
    expect(mine.answers).toEqual({});
    const theirs = (await w.call(w.preparerId, "intake.get", { engagementId: eng })).data as { answers: object };
    expect(Object.keys(theirs.answers).length).toBeGreaterThan(0);
  });

  test("a draft still comes back, so the client can finish it", async () => {
    const eng = w.get<{ engagement_id: string } | null>("SELECT engagement_id FROM intake_responses WHERE submitted_at IS NULL AND answers <> '{}' LIMIT 1");
    if (!eng) return; // the seed may have no drafts with answers; nothing to hide either way
    const draft = (await w.call(clientOf(eng.engagement_id), "intake.get", { engagementId: eng.engagement_id }, "query", "portal")).data as { answers: object };
    expect(Object.keys(draft.answers).length).toBeGreaterThan(0);
  });
});

describe("answers to the preparer's questions", () => {
  test("the client sees a question was answered, not their answer; the preparer sees it", async () => {
    // A fresh question on a return whose primary filer has a login.
    const t = w.get<{ engagement_id: string; user_id: string }>(
      `SELECT e.id AS engagement_id, u.id AS user_id FROM engagements e
         JOIN return_people rp ON rp.engagement_id = e.id AND rp.role = 'primary' JOIN users u ON u.person_id = rp.person_id LIMIT 1`,
    );
    const q = { id: Bun.randomUUIDv7(), engagement_id: t.engagement_id };
    w.db.run("INSERT INTO requests (id, engagement_id, kind, title, status, created_by, created_at) VALUES (?, ?, 'question', 'Did you move?', 'open', ?, ?)", [
      q.id,
      q.engagement_id,
      w.preparerId,
      new Date().toISOString(),
    ]);
    const client = t.user_id;
    expect((await w.call(client, "request.answer", { requestId: q.id, response: "We moved in March." }, "mutation", "portal")).status).toBe(200);
    const mine = ((await w.call(client, "request.list", { engagementId: q.engagement_id }, "query", "portal")).data as { id: string; status: string; response: string | null }[]).find((r) => r.id === q.id)!;
    expect(mine).toMatchObject({ status: "fulfilled", response: null });
    const theirs = ((await w.call(w.preparerId, "request.list", { engagementId: q.engagement_id })).data as { id: string; response: string | null }[]).find((r) => r.id === q.id)!;
    expect(theirs.response).toBe("We moved in March.");
  });
});
