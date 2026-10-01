import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { EngagementDetail, LetterView } from "@app/schema";
import { DEMO_USER_HEADER } from "./identity";
import { sha256 } from "./letters/template";
import { demoWorld, ORIGIN } from "./test-harness";

// Engagement letters: draft from the template, send, every filer signs the exact text they read, frozen after.

let w: Awaited<ReturnType<typeof demoWorld>>;
beforeAll(async () => {
  w = await demoWorld();
  joints = w
    .all<{ id: string }>(
      `SELECT id FROM engagements WHERE stage IN ('invited', 'intake') AND tax_year = 2025 AND letter_id IS NULL
         AND id IN (SELECT engagement_id FROM return_people WHERE role = 'spouse') ORDER BY id`,
    )
    .map((r) => r.id);
});
beforeEach(() => w.use("demo"));
afterAll(() => w.cleanup());

const P = () => w.preparerId;
const view = (res: { data?: unknown }) => LetterView.parse(res.data);
const filersOf = (engagementId: string) =>
  w.all<{ user_id: string; name: string; role: string }>(
    `SELECT u.id AS user_id, p.first_name || ' ' || p.last_name AS name, rp.role
       FROM return_people rp JOIN people p ON p.id = rp.person_id JOIN users u ON u.person_id = p.id
      WHERE rp.engagement_id = ? AND rp.role IN ('primary', 'spouse') ORDER BY rp.role`,
    engagementId,
  );
// Joint returns early in the pipeline, with no letter yet: one for drafting, one for signing.
let joints: string[] = [];
const freshJoint = (i: 0 | 1) => joints[i]!;

async function draftAndSend(engagementIds: string[]) {
  const drafted = view(await w.call(P(), "letter.create", { engagementIds }, "mutation"));
  return view(await w.call(P(), "letter.send", { letterId: drafted.id }, "mutation"));
}
async function sign(userId: string, letter: LetterView, typedName: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const res = await w.handler(
    new Request(`${ORIGIN}/trpc/letter.sign`, {
      method: "POST",
      headers: { [DEMO_USER_HEADER]: userId, "content-type": "application/json", origin: ORIGIN, "user-agent": "LetterTest/1.0", ...headers },
      body: JSON.stringify({ letterId: letter.id, typedName, consent: true, bodySha256: letter.bodySha256, ...extra }),
    }),
    "127.0.0.1",
  );
  const body = (await res.json()) as { result?: { data: unknown }; error?: { message: string } };
  return { status: res.status, data: body.result?.data, error: body.error };
}

describe("drafting", () => {
  test("renders the template with this household's details and nothing left unfilled", async () => {
    const id = freshJoint(0);
    const letter = view(await w.call(P(), "letter.create", { engagementIds: [id] }, "mutation"));
    const names = filersOf(id).map((f) => f.name);
    expect(letter.status).toBe("draft");
    expect(letter.body).toContain("tax year 2025");
    expect(letter.body).toContain(letter.householdName);
    for (const n of names) expect(letter.body).toContain(n);
    expect(letter.body).not.toMatch(/\{\{|\}\}/);
    expect(letter.bodySha256).toBe(sha256(letter.body));
    expect(letter.templateVersion).toBe(1);
    expect(letter.signers.map((s) => s.name)).toEqual(names);
    expect(w.eventsOf("letter.drafted", letter.id)).toHaveLength(1);
    // Clients don't see drafts.
    expect((await w.call(filersOf(id)[0]!.user_id, "letter.get", { engagementId: id })).data).toBeNull();
  });

  test("one return has one live letter; returns from different households can't share one", async () => {
    const id = freshJoint(0);
    expect((await w.call(P(), "letter.create", { engagementIds: [id] }, "mutation")).status).toBe(412);
    const other = w.get<{ id: string }>("SELECT id FROM engagements WHERE stage = 'invited' AND tax_year = 2025 ORDER BY id LIMIT 1").id;
    const another = w.get<{ id: string }>("SELECT id FROM engagements WHERE stage = 'invited' AND tax_year = 2025 ORDER BY id DESC LIMIT 1").id;
    const res = await w.call(P(), "letter.create", { engagementIds: [other, another] }, "mutation");
    expect(res.status).toBe(400);
    expect(res.error!.message).toMatch(/same household/);
  });

  test("a married couple filing separately can share one letter", async () => {
    const mfs = w.all<{ id: string; letter_id: string }>("SELECT id, letter_id FROM engagements WHERE filing_status = 'mfs' AND tax_year = 2025");
    expect(new Set(mfs.map((m) => m.letter_id)).size).toBe(1); // seeded that way
    await w.call(P(), "letter.void", { letterId: mfs[0]!.letter_id, reason: "Fee terms changed" }, "mutation");
    const letter = view(await w.call(P(), "letter.create", { engagementIds: mfs.map((m) => m.id) }, "mutation"));
    expect(letter.engagementIds.sort()).toEqual(mfs.map((m) => m.id).sort());
    expect(letter.body).toContain("Married filing separately");
    expect(letter.signers).toHaveLength(2);
  });

  test("clients can't draft, send or void", async () => {
    const id = w.get<{ id: string }>("SELECT id FROM engagements WHERE stage = 'invited' AND tax_year = 2025 ORDER BY id LIMIT 1").id;
    const client = filersOf(id)[0]!.user_id;
    expect((await w.call(client, "letter.create", { engagementIds: [id] }, "mutation")).status).toBe(403);
  });
});

describe("signing", () => {
  let letter: LetterView;
  let engagementId: string;
  let primary: { user_id: string; name: string };
  let spouse: { user_id: string; name: string };

  beforeAll(async () => {
    engagementId = freshJoint(1);
    letter = await draftAndSend([engagementId]);
    const [p, sp] = filersOf(engagementId);
    primary = p!;
    spouse = sp!;
  });

  test("once sent, the client sees it and can sign; the text is frozen", async () => {
    const seen = view(await w.call(primary.user_id, "letter.get", { engagementId }));
    expect(seen).toMatchObject({ status: "sent", canSign: true, audit: null });
    expect(seen.signers.find((s) => s.isMe)!.name).toBe(primary.name);
    expect(() => w.db.run("UPDATE engagement_letters SET body = 'new terms' WHERE id = ?", [letter.id])).toThrow(/frozen/);
    expect((await w.call(P(), "letter.send", { letterId: letter.id }, "mutation")).status).toBe(412);
  });

  test("the typed name must match, the box must be ticked, and the text must be what was read", async () => {
    expect((await sign(primary.user_id, letter, "Someone Else")).error!.message).toMatch(/Type your full name/);
    expect((await sign(primary.user_id, letter, primary.name, { consent: false })).status).toBe(400);
    const stale = await sign(primary.user_id, letter, primary.name, { bodySha256: sha256("an older version") });
    expect(stale.status).toBe(409);
    expect(stale.error!.message).toMatch(/changed since you opened it/);
  });

  test("each filer signs once; the letter is signed when the last one does", async () => {
    const first = view(await sign(primary.user_id, letter, `  ${primary.name.toUpperCase()} `, {}, { "cf-connecting-ip": "203.0.113.7" }));
    expect(first.status).toBe("sent");
    expect(first.canSign).toBe(false);
    expect((await sign(primary.user_id, letter, primary.name)).status).toBe(412);

    const row = w.get<{ typed_name: string; ip: string; user_agent: string; body_sha256: string; consent_text: string }>(
      "SELECT typed_name, ip, user_agent, body_sha256, consent_text FROM signatures WHERE letter_id = ? AND user_id = ?",
      letter.id,
      primary.user_id,
    );
    expect(row).toMatchObject({ ip: "203.0.113.7", user_agent: "LetterTest/1.0", body_sha256: letter.bodySha256 });
    expect(row.consent_text).toMatch(/typing my name is my signature/);

    const done = view(await sign(spouse.user_id, letter, spouse.name));
    expect(done.status).toBe("signed");
    expect(w.eventsOf("letter.signed", letter.id)).toHaveLength(2);
  });

  test("the preparer sees the full signature record, and the hashes still match the text", async () => {
    const seen = view(await w.call(P(), "letter.get", { engagementId }));
    expect(seen.audit).toHaveLength(2);
    expect(seen.audit!.every((a) => a.hashMatches && a.ip && a.userAgent && a.typedName)).toBe(true);
    const detail = EngagementDetail.parse((await w.call(P(), "engagement.detail", { engagementId })).data);
    expect(detail.letter!.signers.every((s) => s.signedAt)).toBe(true);
  });

  test("someone who can see the return but doesn't file it can't sign", async () => {
    const d = w.get<{ user_id: string; engagement_id: string; letter_id: string }>(
      `SELECT u.id AS user_id, e.id AS engagement_id, e.letter_id FROM users u
         JOIN people p ON p.id = u.person_id AND p.household_id IS NULL
         JOIN household_access ha ON ha.user_id = u.id
         JOIN engagements e ON e.household_id = ha.household_id AND e.tax_year = 2025`,
    );
    // Make sure it's out for signature, so there's something to (not) sign.
    if (w.get<{ status: string }>("SELECT status FROM engagement_letters WHERE id = ?", d.letter_id).status === "draft") {
      await w.call(P(), "letter.send", { letterId: d.letter_id }, "mutation");
    }
    const theirView = view(await w.call(d.user_id, "letter.get", { engagementId: d.engagement_id }));
    expect(theirView).toMatchObject({ status: "sent", canSign: false });
    expect((await sign(d.user_id, theirView, "Anyone")).error!.message).toMatch(/Only the people filing/);
  });

  test("another household can't see or sign it", async () => {
    const stranger = w.get<{ id: string }>(
      "SELECT u.id FROM users u JOIN return_people rp ON rp.person_id = u.person_id WHERE rp.engagement_id <> ? AND u.role = 'client' ORDER BY u.id LIMIT 1",
      engagementId,
    ).id;
    expect((await w.call(stranger, "letter.get", { engagementId })).status).toBe(404);
    expect((await sign(stranger, letter, "Anyone")).status).toBe(404);
  });
});

describe("voiding", () => {
  test("releases the return, needs a reason, keeps signatures, and the gate starts over", async () => {
    const id = w.get<{ id: string }>("SELECT id FROM engagements WHERE stage = 'preparing' AND tax_year = 2025 AND kind = 'original' ORDER BY id LIMIT 1").id;
    const letterId = w.get<{ letter_id: string }>("SELECT letter_id FROM engagements WHERE id = ?", id).letter_id;
    const signaturesBefore = w.get<{ n: number }>("SELECT COUNT(*) AS n FROM signatures WHERE letter_id = ?", letterId).n;
    expect((await w.call(P(), "letter.void", { letterId }, "mutation")).status).toBe(400);
    expect((await w.call(P(), "letter.void", { letterId, reason: "Wrong fee on page one" }, "mutation")).status).toBe(200);
    expect(w.get<{ letter_id: string | null }>("SELECT letter_id FROM engagements WHERE id = ?", id).letter_id).toBeNull();
    expect(w.get<{ n: number }>("SELECT COUNT(*) AS n FROM signatures WHERE letter_id = ?", letterId).n).toBe(signaturesBefore);
    expect(w.eventsOf("letter.voided", letterId)[0]!.reason).toBe("Wrong fee on page one");
    // Moving back and forward again now needs a fresh, signed letter.
    await w.call(P(), "engagement.advanceStage", { engagementId: id, to: "ready", reason: "Letter reissued" }, "mutation");
    const res = await w.call(P(), "engagement.advanceStage", { engagementId: id, to: "preparing" }, "mutation");
    expect(res.error!.message).toMatch(/Send an engagement letter/);
    expect((await w.call(P(), "letter.void", { letterId, reason: "again" }, "mutation")).status).toBe(412);
  });
});
