import type { Database } from "bun:sqlite";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRODUCT_NAME } from "@app/schema";
import { isInside, REPO_ROOT } from "../config";
import type { SessionUser } from "../identity";
import { appendEvent } from "../events";
import { checkPassphrase, sealTar } from "../live/backup";
import type { Storage } from "../storage";

// The offline copy: one folder per household that makes sense without this app, its database or any
// vendor. record.json holds every row that belongs to the household, nested the way a person thinks
// about it (returns by year, each with its people, answers, requests, documents and invoices);
// documents/ holds the uploaded files under their original names; README.txt explains the layout.
//
// Column names are the database's own, so the record can be flattened back into rows (flattenRecord)
// and checked against the source. Logins carry no credentials; people carry SSN last-4 only (the only
// SSN the database has ever held). Optionally sealed with the backup passphrase, in the backup's format.

export const EXPORT_FORMAT = 1;
export const SEALED_EXT = ".btpexport";

type Row = Record<string, unknown>;

// Which rows belong to a household (?1). Every table is here or in PRACTICE_WIDE; a test holds that true
// for new tables, so adding one forces a decision about the export.
const E = "SELECT id FROM engagements WHERE household_id = ?1";
// People: the household's own, anyone on its returns, and helpers (no household of their own) granted access to it.
const P = `SELECT id FROM people WHERE household_id = ?1
             OR id IN (SELECT person_id FROM return_people WHERE engagement_id IN (${E}))
             OR (household_id IS NULL AND id IN (SELECT u.person_id FROM users u JOIN household_access ha ON ha.user_id = u.id WHERE ha.household_id = ?1))`;
const I = `SELECT id FROM invoices WHERE engagement_id IN (${E})`;
export const HOUSEHOLD_SCOPE: Record<string, string> = {
  households: "id = ?1",
  people: `id IN (${P})`,
  users: `person_id IN (${P})`,
  reminder_preferences: `user_id IN (SELECT id FROM users WHERE person_id IN (${P}))`,
  household_access: "household_id = ?1",
  engagement_letters: "household_id = ?1",
  signatures: "letter_id IN (SELECT id FROM engagement_letters WHERE household_id = ?1)",
  engagements: "household_id = ?1",
  return_people: `engagement_id IN (${E})`,
  intake_responses: `engagement_id IN (${E})`,
  sources: "household_id = ?1",
  source_owners: "source_id IN (SELECT id FROM sources WHERE household_id = ?1)",
  return_sources: `engagement_id IN (${E})`,
  requests: `engagement_id IN (${E})`,
  documents: `engagement_id IN (${E}) OR (engagement_id IS NULL AND person_id IN (SELECT id FROM people WHERE household_id = ?1))`,
  invoices: `engagement_id IN (${E})`,
  invoice_lines: `invoice_id IN (${I})`,
  invoice_included: `invoice_id IN (${I})`,
  efile_submissions: `engagement_id IN (${E})`,
  payments: `invoice_id IN (${I})`,
  events: `household_id = ?1 OR engagement_id IN (${E})`,
};
// The practice's own settings and bookkeeping: no client's record.
// invites, sessions, passkeys, authenticator secrets and recovery codes are credentials: never exported.
export const PRACTICE_WIDE = ["document_kinds", "letter_templates", "price_packages", "price_addons", "practice_settings", "webhook_receipts", "schema_migrations", "invites", "sessions", "passkeys", "totp_secrets", "recovery_codes"];
const OMIT: Record<string, string[]> = { users: ["password_hash"] }; // a login, never its credential
const JSON_COLUMNS: Record<string, string[]> = { intake_responses: ["answers"], events: ["data"] };
const ORDER: Record<string, string> = {
  events: "occurred_at, id",
  engagements: "tax_year, kind, created_at, id",
  invoice_lines: "invoice_id, position",
  source_owners: "source_id, person_id",
  return_sources: "engagement_id, source_id",
  return_people: "engagement_id, person_id",
  intake_responses: "engagement_id",
  household_access: "granted_at, id",
  efile_submissions: "submitted_at, id",
  invoice_included: "invoice_id, price_code",
  signatures: "signed_at, id",
  reminder_preferences: "user_id, kind",
};

export function householdRows(db: Database, householdId: string): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  for (const [table, where] of Object.entries(HOUSEHOLD_SCOPE)) {
    const rows = db.query<Row, [string]>(`SELECT * FROM ${table} WHERE ${where} ORDER BY ${ORDER[table] ?? "created_at, id"}`).all(householdId);
    out[table] = rows.map((r) => {
      const row = { ...r };
      for (const c of OMIT[table] ?? []) delete row[c];
      for (const c of JSON_COLUMNS[table] ?? []) row[c] = JSON.parse(row[c] as string);
      return row;
    });
  }
  return out;
}

type FileRef = { path: string; sha256: string; bytes: number } | null;
type DocOut = Row & { file: FileRef };

export type ExportRecord = {
  export_format: number;
  product: string;
  exported_at: string;
  schema_version: number;
  household: Row;
  people: Row[];
  logins: Row[];
  reminders: Row[]; // each login's reminder choices
  access: Row[];
  sources: (Row & { owners: string[] })[];
  letters: (Row & { signatures: Row[] })[];
  returns: (Row & {
    people: Row[];
    intake: Row | null;
    sources: Row[];
    requests: Row[];
    documents: DocOut[];
    efile: Row[];
    invoices: (Row & { lines: Row[]; included: Row[]; payments: Row[] })[];
  })[];
  personal_documents: DocOut[];
  events: Row[];
};

export function buildRecord(rows: Record<string, Row[]>, meta: { exportedAt: string; schemaVersion: number }, files: (doc: Row) => FileRef): ExportRecord {
  const by = (table: string, key: string, value: unknown) => rows[table]!.filter((r) => r[key] === value);
  const doc = (d: Row): DocOut => ({ ...d, file: files(d) });
  return {
    export_format: EXPORT_FORMAT,
    product: PRODUCT_NAME,
    exported_at: meta.exportedAt,
    schema_version: meta.schemaVersion,
    household: rows.households![0]!,
    people: rows.people!,
    logins: rows.users!,
    reminders: rows.reminder_preferences!,
    access: rows.household_access!,
    sources: rows.sources!.map((s) => ({ ...s, owners: by("source_owners", "source_id", s.id).map((o) => o.person_id as string) })),
    letters: rows.engagement_letters!.map((l) => ({ ...l, signatures: by("signatures", "letter_id", l.id) })),
    returns: rows.engagements!.map((e) => ({
      ...e,
      people: by("return_people", "engagement_id", e.id),
      intake: by("intake_responses", "engagement_id", e.id)[0] ?? null,
      sources: by("return_sources", "engagement_id", e.id),
      requests: by("requests", "engagement_id", e.id),
      documents: by("documents", "engagement_id", e.id).map(doc),
      efile: by("efile_submissions", "engagement_id", e.id),
      invoices: by("invoices", "engagement_id", e.id).map((i) => ({ ...i, lines: by("invoice_lines", "invoice_id", i.id), included: by("invoice_included", "invoice_id", i.id), payments: by("payments", "invoice_id", i.id) })),
    })),
    personal_documents: rows.documents!.filter((d) => d.engagement_id === null).map(doc),
    events: rows.events!,
  };
}

// The record back into table rows: the inverse of buildRecord, used to prove nothing was lost.
export function flattenRecord(r: ExportRecord): Record<string, Row[]> {
  const strip = <T extends Row>(row: T, ...keys: string[]) => Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));
  const returns = r.returns;
  return {
    households: [r.household],
    people: r.people,
    users: r.logins,
    reminder_preferences: r.reminders,
    household_access: r.access,
    engagement_letters: r.letters.map((l) => strip(l, "signatures")),
    signatures: r.letters.flatMap((l) => l.signatures),
    engagements: returns.map((e) => strip(e, "people", "intake", "sources", "requests", "documents", "efile", "invoices")),
    efile_submissions: returns.flatMap((e) => e.efile),
    return_people: returns.flatMap((e) => e.people),
    intake_responses: returns.flatMap((e) => (e.intake ? [e.intake] : [])),
    sources: r.sources.map((s) => strip(s, "owners")),
    source_owners: r.sources.flatMap((s) => s.owners.map((person_id) => ({ source_id: s.id, person_id }))),
    return_sources: returns.flatMap((e) => e.sources),
    requests: returns.flatMap((e) => e.requests),
    documents: [...returns.flatMap((e) => e.documents), ...r.personal_documents].map((d) => strip(d, "file")),
    invoices: returns.flatMap((e) => e.invoices.map((i) => strip(i, "lines", "included", "payments"))),
    invoice_included: returns.flatMap((e) => e.invoices.flatMap((i) => i.included)),
    invoice_lines: returns.flatMap((e) => e.invoices.flatMap((i) => i.lines)),
    payments: returns.flatMap((e) => e.invoices.flatMap((i) => i.payments)),
    events: r.events,
  };
}

// A name that's safe as one path segment on any disk.
const segment = (s: string, fallback: string) =>
  s.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "").replace(/^\.+/, "").trim().slice(0, 120) || fallback;

const README = (r: ExportRecord) => `${PRODUCT_NAME}: client record export
Household: ${r.household.display_name as string}
Exported: ${r.exported_at}  (export format ${r.export_format}, database schema ${r.schema_version})

This folder is a complete copy of what the practice holds for this household, outside of the tax
return itself (that lives in the tax software). It needs no app to read.

record.json
  household            the household
  people               everyone in it, and any helper given access: names, dates of birth, contact details, and the last four
                       digits of a Social Security number (the full number is never stored)
  logins               portal logins (email, when activated). No passwords or credentials.
  access               who was given access to this household, by whom, and when it ended
  sources              employers, banks and other sources of tax documents, and whose they are
  letters              engagement letters: the exact text sent, and each signature (typed name,
                       time, the consent wording shown, and the device it was signed from)
  returns              one entry per tax year (and per amended return), each with:
                         people      who was on it and in what role (primary, spouse, dependent)
                         intake      the questionnaire answers
                         sources     which sources were expected that year
                         requests    what the practice asked for, and the answers given
                         documents   every document, and where its file is in this folder
                         efile       each e-file attempt: when it went, and what the IRS or FTB said
                         invoices    each invoice with its lines, what it included at no charge,
                                     and its payments (amounts in cents)
  personal_documents   documents that belong to a person rather than a year (e.g. a photo ID)
  events               the audit trail: every change and every view, who did it and when

documents/
  The uploaded files under their original names, one folder per tax year ("personal" for the rest).
  Each document in record.json names its file and SHA-256 fingerprint, so a copy can be checked.
  A document whose file is null was deleted under the retention policy; its record remains.

Dates and times are UTC (ISO 8601). Money is in cents: 12500 means $125.00.
`;

export type ExportResult = { path: string; encrypted: boolean; documents: number; bytes: number };

export function schemaVersionOf(db: Database) {
  return (db.query("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number | null } | null)?.v ?? 0;
}

function writeFolder(db: Database, storage: Storage, householdId: string, parent: string, at: Date): { name: string; documents: number; bytes: number } {
  const rows = householdRows(db, householdId);
  if (!rows.households!.length) throw new Error(`no household ${householdId}`);
  const household = rows.households![0]!;
  const stamp = at.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const name = `${PRODUCT_NAME}-export-${segment(household.display_name as string, "household")}-${householdId.slice(-8)}-${stamp}`;
  const root = join(parent, name);
  mkdirSync(join(root, "documents"), { recursive: true, mode: 0o700 });

  const taken = new Set<string>();
  let documents = 0;
  let bytes = 0;
  const files = (d: Row): FileRef => {
    if (!d.storage_key || d.purged_at) return null;
    const folder = d.tax_year ? String(d.tax_year) : "personal";
    const original = segment(d.filename as string, `${d.id as string}`);
    const dot = original.lastIndexOf(".");
    const [stem, ext] = dot > 0 ? [original.slice(0, dot), original.slice(dot)] : [original, ""];
    let file = original;
    for (let n = 2; taken.has(`${folder}/${file}`.toLowerCase()); n++) file = `${stem} (${n})${ext}`;
    taken.add(`${folder}/${file}`.toLowerCase());
    const content = storage.get(d.storage_key as string);
    mkdirSync(join(root, "documents", folder), { recursive: true, mode: 0o700 });
    writeFileSync(join(root, "documents", folder, file), content, { mode: 0o600 });
    documents++;
    bytes += content.byteLength;
    return { path: `documents/${folder}/${file}`, sha256: new Bun.CryptoHasher("sha256").update(content).digest("hex"), bytes: content.byteLength };
  };

  const record = buildRecord(rows, { exportedAt: at.toISOString(), schemaVersion: schemaVersionOf(db) }, files);
  writeFileSync(join(root, "record.json"), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  writeFileSync(join(root, "README.txt"), README(record), { mode: 0o600 });
  return { name, documents, bytes };
}

export function checkExportDir(dir: string, dataDir: string | undefined) {
  if (isInside(REPO_ROOT, dir)) throw new Error(`the export folder must be outside the repo (${REPO_ROOT}), got ${dir}`);
  if (dataDir && isInside(dataDir, dir)) throw new Error("the export folder must be outside the data directory");
}

export async function exportHousehold(opts: {
  db: Database;
  storage: Storage;
  dataDir: string | undefined;
  householdId: string;
  outDir: string;
  actor: SessionUser | "system";
  passphrase?: string; // set: seal the folder into one encrypted file
  at?: Date;
}): Promise<ExportResult> {
  checkExportDir(opts.outDir, opts.dataDir);
  const passphrase = opts.passphrase === undefined ? undefined : checkPassphrase(opts.passphrase);
  mkdirSync(opts.outDir, { recursive: true, mode: 0o700 });
  const at = opts.at ?? new Date();

  // One read transaction: the record is a consistent snapshot even while the server runs.
  let result: ExportResult;
  if (passphrase) {
    const staging = mkdtempSync(join(tmpdir(), "btp-export-"));
    chmodSync(staging, 0o700);
    try {
      const w = opts.db.transaction(() => writeFolder(opts.db, opts.storage, opts.householdId, staging, at))();
      const path = join(opts.outDir, `${w.name}${SEALED_EXT}`);
      await sealTar(["-czf", "-", "-C", staging, w.name], path, passphrase);
      result = { path, encrypted: true, documents: w.documents, bytes: w.bytes };
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
  } else {
    const w = opts.db.transaction(() => writeFolder(opts.db, opts.storage, opts.householdId, opts.outDir, at))();
    result = { path: join(opts.outDir, w.name), encrypted: false, documents: w.documents, bytes: w.bytes };
  }

  appendEvent(opts.db, {
    actor: opts.actor,
    type: "household.exported",
    subjectType: "household",
    subjectId: opts.householdId,
    householdId: opts.householdId,
    data: { encrypted: result.encrypted, documents: result.documents },
  });
  return result;
}

// Where exports go: EXPORT_DIR, or in demo a folder under the system temp directory.
export function exportDirFor(mode: "demo" | "live", env: Record<string, string | undefined> = process.env): string | null {
  if (env.EXPORT_DIR) return env.EXPORT_DIR;
  return mode === "demo" ? join(tmpdir(), `${PRODUCT_NAME}-exports`) : null;
}
