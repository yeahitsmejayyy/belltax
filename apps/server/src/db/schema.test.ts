import { beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import {
  AddonTrigger,
  EfileJurisdiction,
  EfileStatus,
  PackageFilingStatus,
  ReminderKind,
  ActorKind,
  DocumentCategory,
  DocumentStatus,
  EngagementKind,
  FilingStatus,
  InvoiceStatus,
  LetterStatus,
  now,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  RequestKind,
  RequestStatus,
  ReturnRole,
  SourceKind,
  Stage,
  tables,
  UserRole,
  WebhookProvider,
} from "@app/schema";
import {
  clientUser,
  document,
  engagement,
  freshDb,
  household,
  id,
  insert,
  invoice,
  issue,
  letter,
  line,
  onReturn,
  payment,
  person,
  preparer,
  request,
  sha256,
  source,
} from "./test-fixtures";

// Test names carry the rule numbers from the docs' business-rules table.

let db: Database;
beforeEach(async () => {
  db = await freshDb();
});

const CHECK = /CHECK constraint failed/;
const UNIQUE = /UNIQUE constraint failed/;
const FK = /FOREIGN KEY constraint failed/;

describe("zod ↔ SQL drift", () => {
  test("every table has a zod row schema and vice versa", () => {
    const sqlTables = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name <> 'schema_migrations' ORDER BY name")
      .all()
      .map((r) => r.name);
    expect(sqlTables).toEqual(Object.keys(tables).sort());
  });

  test("every zod row schema matches its table's columns", () => {
    for (const [table, schema] of Object.entries(tables)) {
      const columns = db
        .query<{ name: string }, []>(`PRAGMA table_info(${table})`)
        .all()
        .map((c) => c.name)
        .sort();
      expect({ table, columns }).toEqual({ table, columns: Object.keys(schema.shape).sort() });
    }
  });

  test("every SQL CHECK enum matches its zod enum", () => {
    const expected: Record<string, readonly string[]> = {
      "users.role": UserRole.options,
      "engagement_letters.status": LetterStatus.options,
      "engagements.kind": EngagementKind.options,
      "engagements.filing_status": FilingStatus.options,
      "engagements.stage": Stage.options,
      "return_people.engagement_kind": EngagementKind.options,
      "return_people.role": ReturnRole.options,
      "sources.kind": SourceKind.options,
      "document_kinds.category": DocumentCategory.options,
      "requests.kind": RequestKind.options,
      "requests.status": RequestStatus.options,
      "documents.status": DocumentStatus.options,
      "invoices.status": InvoiceStatus.options,
      "payments.provider": PaymentProvider.options,
      "payments.method": PaymentMethod.options,
      "payments.status": PaymentStatus.options,
      "webhook_receipts.provider": WebhookProvider.options,
      "events.actor_kind": ActorKind.options,
      "price_packages.filing_status": PackageFilingStatus.options,
      "price_addons.applies_when": AddonTrigger.options,
      "efile_submissions.jurisdiction": EfileJurisdiction.options,
      "efile_submissions.status": EfileStatus.options,
      "reminder_preferences.kind": ReminderKind.options,
    };
    const found: Record<string, string[]> = {};
    const rows = db.query<{ name: string; sql: string }, []>("SELECT name, sql FROM sqlite_master WHERE type = 'table'").all();
    for (const { name, sql } of rows) {
      // `CHECK (x IN (...))`, and the nullable form `CHECK (x IS NULL OR x IN (...))`.
      for (const m of sql.matchAll(/CHECK \((?:\w+ IS NULL OR\s+)?(\w+) IN\s*\(([^)]*)\)\)/g)) {
        const values = [...m[2]!.matchAll(/'([^']*)'/g)].map((v) => v[1]!);
        if (values.length) found[`${name}.${m[1]}`] = values;
      }
    }
    expect(found).toEqual(Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, [...v]])));
  });

  test("rows written by a full household parse with their zod schemas", () => {
    const h = household(db);
    const dana = person(db, h.id, { date_of_birth: "1988-04-02", email: "dana@example.test" });
    const alex = person(db, h.id, { first_name: "Alex", last_name: "Lin", ssn_last4: "9034" });
    const jordan = person(db, h.id, { first_name: "Jordan", ssn_last4: "9056" });
    const prep = preparer(db);
    const u = clientUser(db, dana.id as string);
    insert(db, "household_access", { id: id(), user_id: u.id, household_id: h.id, granted_by: prep.id, granted_at: now() });
    const l = letter(db, h.id as string);
    const e = engagement(db, h.id as string, { filing_status: "mfj", letter_id: l.id });
    onReturn(db, e, dana.id as string, "primary");
    onReturn(db, e, alex.id as string, "spouse");
    onReturn(db, e, jordan.id as string, "dependent", { relationship: "son", months_lived_with: 12 });
    insert(db, "intake_responses", { engagement_id: e.id, form_version: 1, answers: '{"moved":false}', updated_at: now() });
    const s = source(db, h.id as string);
    insert(db, "source_owners", { source_id: s.id, person_id: dana.id });
    insert(db, "return_sources", { engagement_id: e.id, source_id: s.id });
    const r = request(db, e.id as string, prep.id as string, { source_id: s.id, person_id: dana.id });
    document(db, u.id as string, { engagement_id: e.id, tax_year: 2026, request_id: r.id, source_id: s.id, person_id: dana.id });
    db.run("UPDATE engagement_letters SET status = 'sent', sent_at = ? WHERE id = ?", [now(), l.id]);
    insert(db, "signatures", {
      id: id(), letter_id: l.id, person_id: dana.id, user_id: u.id, body_sha256: l.body_sha256,
      typed_name: "Dana Reyes", consent_text: "I agree", ip: "127.0.0.1", user_agent: "test", signed_at: now(),
    });
    const inv = invoice(db, e.id as string, { due_on: "2027-04-15" });
    line(db, inv.id as string, 1, 25000);
    issue(db, inv.id as string);
    payment(db, inv.id as string, 25000, "succeeded");
    insert(db, "webhook_receipts", { provider: "stripe", event_id: "evt_test_1", received_at: now() });
    insert(db, "events", {
      id: id(), occurred_at: now(), actor_kind: "client", actor_user_id: u.id, household_id: h.id,
      engagement_id: e.id, type: "document.uploaded", subject_type: "document", subject_id: "x", data: "{}",
    });

    for (const [table, schema] of Object.entries(tables)) {
      for (const row of db.query(`SELECT * FROM ${table}`).all()) {
        const parsed = schema.safeParse(row);
        if (!parsed.success) throw new Error(`${table}: ${parsed.error.message}`);
      }
    }
  });
});

describe("people & access", () => {
  test("R3 one active grant per user per household; revoking allows a new one", () => {
    const h = household(db);
    const prep = preparer(db);
    const u = clientUser(db, person(db, h.id as string).id as string);
    const grant = { user_id: u.id, household_id: h.id, granted_by: prep.id };
    const first = insert(db, "household_access", { id: id(), ...grant, granted_at: now() });
    expect(() => insert(db, "household_access", { id: id(), ...grant, granted_at: now() })).toThrow(UNIQUE);
    db.run("UPDATE household_access SET revoked_at = ? WHERE id = ?", [now(), first.id]);
    expect(() => insert(db, "household_access", { id: id(), ...grant, granted_at: now() })).not.toThrow();
  });

  test("R4 a person has at most one login", () => {
    const p = person(db, household(db).id as string);
    clientUser(db, p.id as string);
    expect(() => clientUser(db, p.id as string)).toThrow(UNIQUE);
  });

  test("R5 a client login needs a person; a preparer login has none", () => {
    expect(() => insert(db, "users", { id: id(), role: "client", email: "a@example.test", created_at: now() })).toThrow(CHECK);
    const p = person(db, household(db).id as string);
    expect(() =>
      insert(db, "users", { id: id(), role: "preparer", email: "b@example.test", person_id: p.id, created_at: now() }),
    ).toThrow(CHECK);
  });

  test("login emails are unique regardless of case", () => {
    const h = household(db);
    clientUser(db, person(db, h.id as string).id as string, { email: "Dana@Example.test" });
    expect(() => clientUser(db, person(db, h.id as string).id as string, { email: "dana@example.test" })).toThrow(UNIQUE);
  });
});

describe("returns", () => {
  test("R6 a person files at most one original return per year", () => {
    const h = household(db);
    const dana = person(db, h.id as string);
    onReturn(db, engagement(db, h.id as string), dana.id as string, "primary");
    expect(() => onReturn(db, engagement(db, h.id as string), dana.id as string, "spouse")).toThrow(UNIQUE);
    // A different year is fine.
    expect(() => onReturn(db, engagement(db, h.id as string, { tax_year: 2025 }), dana.id as string, "primary")).not.toThrow();
  });

  test("R6 / R35 an amendment is an extra return for the same filer and year", () => {
    const h = household(db);
    const dana = person(db, h.id as string);
    const original = engagement(db, h.id as string);
    onReturn(db, original, dana.id as string, "primary");
    const amended = engagement(db, h.id as string, { kind: "amended", amends_id: original.id });
    expect(() => onReturn(db, amended, dana.id as string, "primary")).not.toThrow();
  });

  test("R7 a person is claimed as a dependent at most once per year", () => {
    const h = household(db);
    const kid = person(db, h.id as string, { first_name: "Jordan" });
    onReturn(db, engagement(db, h.id as string), kid.id as string, "dependent");
    const other = household(db, { display_name: "Other parent" });
    expect(() => onReturn(db, engagement(db, other.id as string), kid.id as string, "dependent")).toThrow(UNIQUE);
  });

  test("R8 a dependent may still file their own return that year", () => {
    const h = household(db);
    const kid = person(db, h.id as string, { first_name: "Jordan" });
    onReturn(db, engagement(db, h.id as string), kid.id as string, "dependent");
    expect(() => onReturn(db, engagement(db, h.id as string), kid.id as string, "primary")).not.toThrow();
  });

  test("R9 a person appears on a return once", () => {
    const h = household(db);
    const e = engagement(db, h.id as string);
    const dana = person(db, h.id as string);
    onReturn(db, e, dana.id as string, "primary");
    expect(() => onReturn(db, e, dana.id as string, "dependent")).toThrow(UNIQUE);
  });

  test("R10 at most one primary and one spouse per return", () => {
    const h = household(db);
    const e = engagement(db, h.id as string);
    onReturn(db, e, person(db, h.id as string).id as string, "primary");
    onReturn(db, e, person(db, h.id as string).id as string, "spouse");
    expect(() => onReturn(db, e, person(db, h.id as string).id as string, "primary")).toThrow(UNIQUE);
    expect(() => onReturn(db, e, person(db, h.id as string).id as string, "spouse")).toThrow(UNIQUE);
    expect(() => onReturn(db, e, person(db, h.id as string).id as string, "dependent")).not.toThrow();
  });

  test("R11 a return-person row carries its return's tax year and kind", () => {
    const h = household(db);
    const e = engagement(db, h.id as string);
    const p = person(db, h.id as string);
    expect(() => onReturn(db, { ...e, tax_year: 2025 }, p.id as string, "primary")).toThrow(FK);
    expect(() => onReturn(db, { ...e, kind: "amended" }, p.id as string, "primary")).toThrow(FK);
  });

  test("dependent-only facts can't be set on a filer", () => {
    const h = household(db);
    const e = engagement(db, h.id as string);
    expect(() => onReturn(db, e, person(db, h.id as string).id as string, "primary", { relationship: "self" })).toThrow(CHECK);
  });

  test("R14 tax year and filing status are checked", () => {
    const h = household(db);
    expect(() => engagement(db, h.id as string, { tax_year: 1999 })).toThrow(CHECK);
    expect(() => engagement(db, h.id as string, { filing_status: "joint" })).toThrow(CHECK);
    expect(() => engagement(db, h.id as string, { stage: "done" })).toThrow(CHECK);
  });

  test("R35 an amendment points at an original return from the same year", () => {
    const h = household(db);
    const original = engagement(db, h.id as string);
    expect(() => engagement(db, h.id as string, { kind: "amended" })).toThrow(CHECK);
    expect(() => engagement(db, h.id as string, { kind: "original", amends_id: original.id })).toThrow(CHECK);
    expect(() => engagement(db, h.id as string, { kind: "amended", amends_id: original.id, tax_year: 2025 })).toThrow(FK);
    const amended = engagement(db, h.id as string, { kind: "amended", amends_id: original.id });
    expect(() => engagement(db, h.id as string, { kind: "amended", amends_id: amended.id })).toThrow(
      /must point at an original return/,
    );
  });

  test("intake answers must be valid JSON", () => {
    const e = engagement(db, household(db).id as string);
    expect(() =>
      insert(db, "intake_responses", { engagement_id: e.id, form_version: 1, answers: "{nope", updated_at: now() }),
    ).toThrow(CHECK);
  });
});

describe("requests & documents", () => {
  test("R15 a document belongs to a person, a return, or both", () => {
    const prep = preparer(db);
    expect(() => document(db, prep.id as string)).toThrow(CHECK);
    const p = person(db, household(db).id as string);
    expect(() => document(db, prep.id as string, { kind: "photo_id", person_id: p.id })).not.toThrow();
  });

  test("R16 a return's document carries that return's tax year", () => {
    const prep = preparer(db);
    const e = engagement(db, household(db).id as string);
    expect(() => document(db, prep.id as string, { engagement_id: e.id })).toThrow(CHECK);
    expect(() => document(db, prep.id as string, { engagement_id: e.id, tax_year: 2025 })).toThrow(FK);
    expect(() => document(db, prep.id as string, { engagement_id: e.id, tax_year: 2026 })).not.toThrow();
  });

  test("R17 a rejected document states why", () => {
    const prep = preparer(db);
    const p = person(db, household(db).id as string);
    const base = { person_id: p.id, status: "rejected", reviewed_at: now() };
    expect(() => document(db, prep.id as string, base)).toThrow(CHECK);
    expect(() => document(db, prep.id as string, { ...base, reject_reason: "Photo is blurry" })).not.toThrow();
  });

  test("R18 a document request names a kind; a question doesn't", () => {
    const prep = preparer(db);
    const e = engagement(db, household(db).id as string);
    expect(() => request(db, e.id as string, prep.id as string, { document_kind: null })).toThrow(CHECK);
    expect(() =>
      request(db, e.id as string, prep.id as string, { kind: "question", document_kind: "w2", title: "Did you move?" }),
    ).toThrow(CHECK);
    expect(() =>
      request(db, e.id as string, prep.id as string, { kind: "question", document_kind: null, title: "Did you move?" }),
    ).not.toThrow();
  });

  test("R19 a request's documents come from its own return", () => {
    const prep = preparer(db);
    const h = household(db);
    const e1 = engagement(db, h.id as string);
    const e2 = engagement(db, h.id as string);
    const r = request(db, e1.id as string, prep.id as string);
    expect(() => document(db, prep.id as string, { engagement_id: e2.id, tax_year: 2026, request_id: r.id })).toThrow(FK);
    expect(() => document(db, prep.id as string, { engagement_id: e1.id, tax_year: 2026, request_id: r.id })).not.toThrow();
  });

  test("R34 purging keeps a tombstone: no storage key only when purged", () => {
    const prep = preparer(db);
    const p = person(db, household(db).id as string);
    const d = document(db, prep.id as string, { person_id: p.id });
    expect(() => db.run("UPDATE documents SET storage_key = NULL WHERE id = ?", [d.id])).toThrow(CHECK);
    expect(() => db.run("UPDATE documents SET storage_key = NULL, purged_at = ? WHERE id = ?", [now(), d.id])).not.toThrow();
  });

  test("R37 a document or request from a source belongs to a return that reports it", () => {
    const prep = preparer(db);
    const h = household(db);
    const e = engagement(db, h.id as string);
    const s = source(db, h.id as string);
    const onE = { engagement_id: e.id, tax_year: 2026, source_id: s.id };
    expect(() => document(db, prep.id as string, onE)).toThrow(FK);
    expect(() => request(db, e.id as string, prep.id as string, { source_id: s.id })).toThrow(FK);
    insert(db, "return_sources", { engagement_id: e.id, source_id: s.id });
    expect(() => document(db, prep.id as string, onE)).not.toThrow();
    expect(() => request(db, e.id as string, prep.id as string, { source_id: s.id })).not.toThrow();
  });

  test("R39 document kinds come from the lookup table", () => {
    const prep = preparer(db);
    const p = person(db, household(db).id as string);
    expect(() => document(db, prep.id as string, { person_id: p.id, kind: "w-2" })).toThrow(FK);
    insert(db, "document_kinds", { code: "form_8889", form_name: "Form 8889", label: "HSA", category: "deduction" });
    expect(() => document(db, prep.id as string, { person_id: p.id, kind: "form_8889" })).not.toThrow();
  });
});

describe("engagement letter", () => {
  function signedSetup() {
    const h = household(db);
    const dana = person(db, h.id as string);
    const u = clientUser(db, dana.id as string);
    const l = letter(db, h.id as string);
    const sign = (over: Record<string, string | null> = {}) =>
      insert(db, "signatures", {
        id: id(), letter_id: l.id, person_id: dana.id, user_id: u.id, body_sha256: l.body_sha256,
        typed_name: "Dana Reyes", consent_text: "I agree", ip: "127.0.0.1", user_agent: "test", signed_at: now(), ...over,
      });
    const send = () => db.run("UPDATE engagement_letters SET status = 'sent', sent_at = ? WHERE id = ?", [now(), l.id]);
    return { h, dana, u, l, sign, send };
  }

  test("R20 a letter covers returns from one household and one tax year", () => {
    const h = household(db);
    const other = household(db, { display_name: "Other" });
    const l = letter(db, h.id as string);
    expect(() => engagement(db, other.id as string, { letter_id: l.id })).toThrow(FK);
    expect(() => engagement(db, h.id as string, { letter_id: l.id, tax_year: 2025 })).toThrow(FK);
    expect(() => engagement(db, h.id as string, { letter_id: l.id })).not.toThrow();
  });

  test("a draft letter can't be signed", () => {
    const { sign } = signedSetup();
    expect(() => sign()).toThrow(/only a sent engagement letter/);
  });

  test("R21 a signature is bound to the exact text signed", () => {
    const { sign, send } = signedSetup();
    send();
    expect(() => sign({ body_sha256: sha256("different words") })).toThrow(FK);
    expect(() => sign()).not.toThrow();
  });

  test("R22 whoever clicked Sign is the person who signed", () => {
    const { h, sign, send } = signedSetup();
    send();
    const alex = person(db, h.id as string, { first_name: "Alex" });
    expect(() => sign({ person_id: alex.id as string })).toThrow(FK);
  });

  test("R23 one signature per person per letter; signatures are permanent", () => {
    const { sign, send } = signedSetup();
    send();
    const s = sign();
    expect(() => sign()).toThrow(UNIQUE);
    expect(() => db.run("UPDATE signatures SET typed_name = 'x' WHERE id = ?", [s.id])).toThrow(/permanent/);
    expect(() => db.run("DELETE FROM signatures WHERE id = ?", [s.id])).toThrow(/permanent/);
  });

  test("R24 letter text is frozen once sent; status only moves forward", () => {
    const { l, send } = signedSetup();
    expect(() => db.run("UPDATE engagement_letters SET body = 'edited', body_sha256 = ? WHERE id = ?", [sha256("edited"), l.id])).not.toThrow();
    send();
    expect(() => db.run("UPDATE engagement_letters SET body = 'again' WHERE id = ?", [l.id])).toThrow(/frozen/);
    expect(() => db.run("UPDATE engagement_letters SET status = 'draft' WHERE id = ?", [l.id])).toThrow(/backward/);
    expect(() => db.run("DELETE FROM engagement_letters WHERE id = ?", [l.id])).toThrow(/void it instead/);
    db.run("UPDATE engagement_letters SET status = 'void' WHERE id = ?", [l.id]);
    expect(() => db.run("UPDATE engagement_letters SET status = 'sent' WHERE id = ?", [l.id])).toThrow(/backward/);
  });
});

describe("money", () => {
  function draft() {
    const e = engagement(db, household(db).id as string);
    return invoice(db, e.id as string);
  }

  test("R26 amounts are positive integer cents", () => {
    const inv = draft();
    expect(() => line(db, inv.id as string, 1, 0)).toThrow(CHECK);
    expect(() => line(db, inv.id as string, 1, 100, { quantity: 0 })).toThrow(CHECK);
    expect(() => line(db, inv.id as string, 1, 99.5)).toThrow(/cannot store REAL value in INTEGER column|datatype mismatch/);
  });

  test("an invoice can't be issued without lines, or paid before it's issued", () => {
    const inv = draft();
    expect(() => issue(db, inv.id as string)).toThrow(/at least one line/);
    line(db, inv.id as string, 1, 25000);
    expect(() => payment(db, inv.id as string, 25000, "pending")).toThrow(/issued invoice/);
    issue(db, inv.id as string);
    expect(() => payment(db, inv.id as string, 25000, "pending")).not.toThrow();
  });

  test("R27 an issued invoice's lines are frozen; status only moves forward", () => {
    const inv = draft();
    const l1 = line(db, inv.id as string, 1, 25000);
    issue(db, inv.id as string);
    expect(() => line(db, inv.id as string, 2, 5000)).toThrow(/frozen/);
    expect(() => db.run("UPDATE invoice_lines SET unit_amount_cents = 1 WHERE id = ?", [l1.id])).toThrow(/frozen/);
    expect(() => db.run("DELETE FROM invoice_lines WHERE id = ?", [l1.id])).toThrow(/frozen/);
    expect(() => db.run("UPDATE invoices SET status = 'draft' WHERE id = ?", [inv.id])).toThrow(/backward/);
  });

  test("R28 balances are derived: unpaid → failed → partial → paid", () => {
    const inv = draft();
    line(db, inv.id as string, 1, 20000);
    line(db, inv.id as string, 2, 2500, { quantity: 2, description: "CA 540" });
    const balance = () =>
      db.query("SELECT total_cents, paid_cents, balance_cents, settlement FROM invoice_balances WHERE invoice_id = ?").get(inv.id!);
    expect(balance()).toEqual({ total_cents: 25000, paid_cents: 0, balance_cents: 25000, settlement: "draft" });
    issue(db, inv.id as string);
    expect(balance()).toMatchObject({ settlement: "unpaid" });
    payment(db, inv.id as string, 25000, "failed", "2026-10-01T10:00:00.000Z");
    expect(balance()).toMatchObject({ balance_cents: 25000, settlement: "failed_last_attempt" });
    payment(db, inv.id as string, 10000, "succeeded", "2026-10-02T10:00:00.000Z");
    expect(balance()).toMatchObject({ paid_cents: 10000, balance_cents: 15000, settlement: "partial" });
    payment(db, inv.id as string, 15000, "succeeded", "2026-10-03T10:00:00.000Z");
    expect(balance()).toMatchObject({ balance_cents: 0, settlement: "paid" });
  });

  test("R29 a Stripe event is recorded at most once", () => {
    insert(db, "webhook_receipts", { provider: "stripe", event_id: "evt_1", received_at: now() });
    expect(() => insert(db, "webhook_receipts", { provider: "stripe", event_id: "evt_1", received_at: now() })).toThrow(UNIQUE);
  });
});

describe("audit", () => {
  test("R31 events are append-only", () => {
    const e = insert(db, "events", {
      id: id(), occurred_at: now(), actor_kind: "system", type: "letter.template_edited", subject_type: "template", subject_id: "1", data: "{}",
    });
    expect(() => db.run("UPDATE events SET reason = 'x' WHERE id = ?", [e.id])).toThrow(/append-only/);
    expect(() => db.run("DELETE FROM events WHERE id = ?", [e.id])).toThrow(/append-only/);
  });

  test("a human actor names the user; the system and Stripe don't", () => {
    const base = { occurred_at: now(), type: "session.created", subject_type: "session", subject_id: "1", data: "{}" };
    expect(() => insert(db, "events", { id: id(), actor_kind: "client", ...base })).toThrow(CHECK);
    expect(() => insert(db, "events", { id: id(), actor_kind: "stripe", actor_user_id: preparer(db).id, ...base })).toThrow(CHECK);
  });

  test("timestamps must be ISO 8601 UTC", () => {
    expect(() => household(db, { created_at: "2026-09-22 10:00:00" })).toThrow(CHECK);
    expect(() => household(db, { created_at: "2026-09-22T10:00:00.000+02:00" })).toThrow(CHECK);
  });
});

describe("views", () => {
  test("R2 client_access: filers keep access after moving; grants can be revoked", () => {
    const parents = household(db);
    const dana = person(db, parents.id as string);
    const danaLogin = clientUser(db, dana.id as string);
    const e = engagement(db, parents.id as string);
    onReturn(db, e, dana.id as string, "primary");

    const helper = person(db, null, { first_name: "Sam" });
    const helperLogin = clientUser(db, helper.id as string);
    const grant = insert(db, "household_access", {
      id: id(), user_id: helperLogin.id, household_id: parents.id, granted_by: preparer(db).id, granted_at: now(),
    });
    const access = (userId: unknown) =>
      db.query("SELECT via FROM client_access WHERE user_id = ? AND engagement_id = ?").all(userId as string, e.id!);

    expect(access(helperLogin.id)).toEqual([{ via: "grant" }]);
    db.run("UPDATE household_access SET revoked_at = ? WHERE id = ?", [now(), grant.id]);
    expect(access(helperLogin.id)).toEqual([]);

    // Dana moves out; the return she filed is still hers.
    db.run("UPDATE people SET household_id = ? WHERE id = ?", [household(db, { display_name: "Dana Reyes" }).id, dana.id]);
    expect(access(danaLogin.id)).toEqual([{ via: "filer" }]);
  });

  test("R38 expected_documents: last year's open sources seed this year's checklist", () => {
    const h = household(db);
    const dana = person(db, h.id as string);
    const last = engagement(db, h.id as string, { tax_year: 2025 });
    onReturn(db, last, dana.id as string, "primary");
    const acme = source(db, h.id as string, { label: "Acme Corp" });
    const closed = source(db, h.id as string, { kind: "brokerage", label: "Old brokerage", last_year: 2025 });
    insert(db, "return_sources", { engagement_id: last.id, source_id: acme.id });
    insert(db, "return_sources", { engagement_id: last.id, source_id: closed.id });

    const current = engagement(db, h.id as string, { tax_year: 2026 });
    onReturn(db, current, dana.id as string, "primary");
    const expected = () =>
      db.query("SELECT source_label FROM expected_documents WHERE engagement_id = ?").all(current.id!);
    expect(expected()).toEqual([{ source_label: "Acme Corp" }]);

    insert(db, "return_sources", { engagement_id: current.id, source_id: acme.id });
    expect(expected()).toEqual([]);
  });

  test("return_complexity labels a rental as involved and plain wages as simple", () => {
    const h = household(db);
    const simple = engagement(db, h.id as string);
    const involved = engagement(db, h.id as string);
    const job = source(db, h.id as string);
    const rental = source(db, h.id as string, { kind: "rental_property", label: "Elm St duplex" });
    insert(db, "return_sources", { engagement_id: simple.id, source_id: job.id });
    insert(db, "return_sources", { engagement_id: involved.id, source_id: job.id });
    insert(db, "return_sources", { engagement_id: involved.id, source_id: rental.id });
    const label = (eid: unknown) =>
      db.query<{ label: string; rentals: number }, [string]>("SELECT label, rentals FROM return_complexity WHERE engagement_id = ?").get(eid as string);
    expect(label(simple.id)).toEqual({ label: "simple", rentals: 0 });
    expect(label(involved.id)).toEqual({ label: "involved", rentals: 1 });
  });

  test("pipeline_rows summarises filers, open requests and balance", () => {
    const h = household(db);
    const e = engagement(db, h.id as string, { stage: "documents" });
    onReturn(db, e, person(db, h.id as string).id as string, "primary");
    onReturn(db, e, person(db, h.id as string, { first_name: "Alex" }).id as string, "spouse");
    request(db, e.id as string, preparer(db).id as string);
    const inv = invoice(db, e.id as string);
    line(db, inv.id as string, 1, 30000);
    issue(db, inv.id as string);
    const row = db.query("SELECT household_name, stage, open_requests, balance_cents, filers FROM pipeline_rows WHERE engagement_id = ?").get(e.id!) as Record<string, unknown>;
    expect(row).toMatchObject({ household_name: "Reyes-Lin", stage: "documents", open_requests: 1, balance_cents: 30000 });
    expect(String(row.filers).split(" & ").sort()).toEqual(["Alex", "Dana"]);
  });
});
