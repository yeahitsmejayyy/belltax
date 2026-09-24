import { Database } from "bun:sqlite";
import { now } from "@app/schema";
import { applySchema } from "./schema";

// Test-only builders. Every name here is invented; SSN fragments stay in the invalid 9xx style.

type Row = Record<string, string | number | null>;

export async function freshDb() {
  const db = new Database(":memory:", { strict: true });
  await applySchema(db);
  return db;
}

export const id = () => Bun.randomUUIDv7();
export const sha256 = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");

export function insert<T extends Row>(db: Database, table: string, row: T): T {
  const cols = Object.keys(row);
  db.run(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    cols.map((c) => row[c] ?? null),
  );
  return row;
}

export const household = (db: Database, over: Row = {}) =>
  insert(db, "households", { id: id(), display_name: "Reyes-Lin", created_at: now(), ...over });

export const person = (db: Database, household_id: string | null, over: Row = {}) =>
  insert(db, "people", {
    id: id(),
    household_id,
    first_name: "Dana",
    last_name: "Reyes",
    ssn_last4: "9012",
    created_at: now(),
    ...over,
  });

export const clientUser = (db: Database, person_id: string, over: Row = {}) =>
  insert(db, "users", { id: id(), role: "client", email: `${id()}@example.test`, person_id, created_at: now(), ...over });

export const preparer = (db: Database) =>
  insert(db, "users", { id: id(), role: "preparer", email: `${id()}@example.test`, person_id: null, created_at: now() });

export const engagement = (db: Database, household_id: string, over: Row = {}) =>
  insert(db, "engagements", {
    id: id(),
    household_id,
    tax_year: 2026,
    kind: "original",
    amends_id: null,
    stage: "invited",
    stage_changed_at: now(),
    created_at: now(),
    ...over,
  });

type Eng = { id: string; tax_year: string | number | null; kind: string | number | null };

export const onReturn = (db: Database, e: Eng, person_id: string, role: string, over: Row = {}) =>
  insert(db, "return_people", {
    engagement_id: e.id,
    person_id,
    tax_year: e.tax_year,
    engagement_kind: e.kind,
    role,
    ...over,
  });

export const letter = (db: Database, household_id: string, over: Row = {}) => {
  const body = (over.body as string) ?? "Engagement letter for tax year 2026.";
  return insert(db, "engagement_letters", {
    id: id(),
    household_id,
    tax_year: 2026,
    template_version: 1,
    body,
    body_sha256: sha256(body),
    status: "draft",
    created_at: now(),
    ...over,
  });
};

export const source = (db: Database, household_id: string, over: Row = {}) =>
  insert(db, "sources", { id: id(), household_id, kind: "employer", label: "Acme Corp", created_at: now(), ...over });

export const request = (db: Database, engagement_id: string, created_by: string, over: Row = {}) =>
  insert(db, "requests", {
    id: id(),
    engagement_id,
    kind: "document",
    document_kind: "w2",
    title: "Upload your W-2",
    status: "open",
    created_by,
    created_at: now(),
    ...over,
  });

export const document = (db: Database, uploaded_by: string, over: Row = {}) =>
  insert(db, "documents", {
    id: id(),
    kind: "w2",
    status: "uploaded",
    filename: "w2.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024,
    sha256: sha256("fake pdf bytes"),
    storage_key: `demo/${id()}.pdf`,
    uploaded_by,
    created_at: now(),
    ...over,
  });

export const invoice = (db: Database, engagement_id: string, over: Row = {}) =>
  insert(db, "invoices", {
    id: id(),
    engagement_id,
    number: `2026-${Math.floor(Math.random() * 1e6)}`,
    status: "draft",
    created_at: now(),
    ...over,
  });

export const line = (db: Database, invoice_id: string, position: number, unit_amount_cents: number, over: Row = {}) =>
  insert(db, "invoice_lines", {
    id: id(),
    invoice_id,
    position,
    description: "Federal 1040",
    quantity: 1,
    unit_amount_cents,
    ...over,
  });

export const payment = (db: Database, invoice_id: string, amount_cents: number, status: string, created_at = now()) =>
  insert(db, "payments", {
    id: id(),
    invoice_id,
    provider: "stripe",
    checkout_session_id: `cs_test_${id()}`,
    amount_cents,
    status,
    created_at,
    updated_at: created_at,
  });

export const issue = (db: Database, invoice_id: string) =>
  db.run("UPDATE invoices SET status = 'issued', issued_at = ? WHERE id = ?", [now(), invoice_id]);
