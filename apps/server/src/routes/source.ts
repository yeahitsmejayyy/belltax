import { TRPCError } from "@trpc/server";
import type { Database } from "bun:sqlite";
import {
  AttachSourcesInput,
  CreateExpectedInput,
  DetachSourceInput,
  now,
  RequestView,
  SOURCE_DOCUMENT_KINDS,
  SourceAddInput,
  SourceCloseInput,
  SourceLeaveInput,
  SourceListInput,
  SourceSetOwnersInput,
  SourceUpdateInput,
  SourceView,
  StartFromLastYearInput,
  type SourceKind,
} from "@app/schema";
import { z } from "zod";
import { engagementFor, type EngagementRef } from "../access";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import type { SessionUser } from "../identity";
import { authedProcedure, preparerProcedure, router } from "../trpc";
import { listRequests } from "./request";

// Sources: the employers, accounts, properties and businesses that produce tax documents year after
// year. Amounts stay in ProSeries; the portal only knows a source exists, who owns it, and which
// returns reported it. Last year's sources become this year's checklist.

type SourceRow = { id: string; household_id: string; kind: SourceKind; label: string; first_year: number | null; last_year: number | null };

const notFound = (what: string) => new TRPCError({ code: "NOT_FOUND", message: `${what} not found.` });
const sourceRow = (db: Database, id: string) =>
  db.query<SourceRow, [string]>("SELECT id, household_id, kind, label, first_year, last_year FROM sources WHERE id = ?").get(id);

function ownersOf(db: Database, sourceId: string) {
  return db
    .query<{ person_id: string; name: string }, [string]>(
      "SELECT p.id AS person_id, p.first_name || ' ' || p.last_name AS name FROM source_owners so JOIN people p ON p.id = so.person_id WHERE so.source_id = ? ORDER BY p.first_name",
    )
    .all(sourceId)
    .map((o) => ({ personId: o.person_id, name: o.name }));
}

function setOwners(db: Database, sourceId: string, owners: string[]) {
  for (const o of owners) if (!db.query("SELECT 1 FROM people WHERE id = ?").get(o)) throw notFound("Owner");
  db.run("DELETE FROM source_owners WHERE source_id = ?", [sourceId]);
  for (const o of new Set(owners)) db.run("INSERT INTO source_owners (source_id, person_id) VALUES (?, ?)", [sourceId, o]);
}

const isOpenFor = (s: SourceRow, year: number) => (s.first_year ?? -Infinity) <= year && year <= (s.last_year ?? Infinity);

// A source belongs on a return if it's this household's, or one of its owners files the return.
function assertBelongs(db: Database, e: EngagementRef, s: SourceRow) {
  if (s.household_id === e.household_id) return;
  const ownerOnReturn = db
    .query("SELECT 1 FROM source_owners so JOIN return_people rp ON rp.person_id = so.person_id WHERE so.source_id = ? AND rp.engagement_id = ?")
    .get(s.id, e.id);
  if (!ownerOnReturn) throw new TRPCError({ code: "BAD_REQUEST", message: `${s.label} doesn't belong to this household or anyone on this return.` });
}

function attach(db: Database, user: SessionUser, e: EngagementRef, s: SourceRow) {
  if (db.query("SELECT 1 FROM return_sources WHERE engagement_id = ? AND source_id = ?").get(e.id, s.id)) return false;
  db.run("INSERT INTO return_sources (engagement_id, source_id) VALUES (?, ?)", [e.id, s.id]);
  appendEvent(db, { actor: user, type: "source.attached", subjectType: "source", subjectId: s.id, householdId: e.household_id, engagementId: e.id });
  return true;
}

// On this return, plus last year's still-open sources for the same filers not yet carried forward.
function sourcesFor(db: Database, e: EngagementRef): { source: SourceRow; onReturn: boolean }[] {
  const attached = db
    .query<SourceRow, [string]>(
      "SELECT s.id, s.household_id, s.kind, s.label, s.first_year, s.last_year FROM return_sources rs JOIN sources s ON s.id = rs.source_id WHERE rs.engagement_id = ? ORDER BY s.kind, s.label",
    )
    .all(e.id);
  const expected = db
    .query<SourceRow, [string]>(
      "SELECT s.id, s.household_id, s.kind, s.label, s.first_year, s.last_year FROM expected_documents x JOIN sources s ON s.id = x.source_id WHERE x.engagement_id = ? ORDER BY s.kind, s.label",
    )
    .all(e.id);
  return [...attached.map((source) => ({ source, onReturn: true })), ...expected.map((source) => ({ source, onReturn: false }))];
}

const toView = (db: Database, s: SourceRow, onReturn: boolean): SourceView => ({
  id: s.id,
  kind: s.kind,
  label: s.label,
  owners: ownersOf(db, s.id),
  firstYear: s.first_year,
  lastYear: s.last_year,
  onReturn,
  expectedDocuments: [...SOURCE_DOCUMENT_KINDS[s.kind]],
});

const sourceEvent = (db: Database, user: SessionUser, type: string, s: { id: string; household_id: string }, extra: { engagementId?: string; reason?: string | null } = {}) =>
  appendEvent(db, { actor: user, type, subjectType: "source", subjectId: s.id, householdId: s.household_id, engagementId: extra.engagementId ?? null, reason: extra.reason ?? null });

export const sourceRouter = router({
  add: preparerProcedure
    .input(SourceAddInput)
    .output(SourceView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      if (!db.query("SELECT 1 FROM households WHERE id = ?").get(input.householdId)) throw notFound("Household");
      const id = Bun.randomUUIDv7();
      db.transaction(() => {
        db.run("INSERT INTO sources (id, household_id, kind, label, first_year, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
          id, input.householdId, input.kind, input.label, input.firstYear ?? null, now(),
        ]);
        setOwners(db, id, input.owners); // same transaction: never a source without an owner (R36)
        sourceEvent(db, ctx.user, "source.added", { id, household_id: input.householdId });
      })();
      return toView(db, sourceRow(db, id)!, false);
    }),

  update: preparerProcedure
    .input(SourceUpdateInput)
    .output(SourceView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const s = sourceRow(db, input.sourceId) ?? (() => { throw notFound("Source"); })();
      db.transaction(() => {
        if (input.kind) db.run("UPDATE sources SET kind = ? WHERE id = ?", [input.kind, s.id]);
        if (input.label) db.run("UPDATE sources SET label = ? WHERE id = ?", [input.label, s.id]);
        if (input.lastYear !== undefined) db.run("UPDATE sources SET last_year = ? WHERE id = ?", [input.lastYear, s.id]);
        sourceEvent(db, ctx.user, input.lastYear === null ? "source.reopened" : "source.updated", s);
      })();
      return toView(db, sourceRow(db, s.id)!, false);
    }),

  // Last year it produced documents. From the year after, the checklist stops asking for it.
  close: preparerProcedure
    .input(SourceCloseInput)
    .output(SourceView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const s = sourceRow(db, input.sourceId) ?? (() => { throw notFound("Source"); })();
      if (s.first_year !== null && input.lastYear < s.first_year) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${s.label} started in ${s.first_year}; it can't have ended before that.` });
      }
      db.transaction(() => {
        db.run("UPDATE sources SET last_year = ? WHERE id = ?", [input.lastYear, s.id]);
        sourceEvent(db, ctx.user, "source.closed", s, { reason: input.reason ?? null });
      })();
      return toView(db, sourceRow(db, s.id)!, false);
    }),

  setOwners: preparerProcedure
    .input(SourceSetOwnersInput)
    .output(SourceView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const s = sourceRow(db, input.sourceId) ?? (() => { throw notFound("Source"); })();
      db.transaction(() => {
        setOwners(db, s.id, input.owners);
        sourceEvent(db, ctx.user, "source.owners_set", s);
      })();
      return toView(db, s, false);
    }),

  // What we think this return's people have: what's on the return, and last year's still-open sources.
  list: authedProcedure
    .input(SourceListInput)
    .output(z.array(SourceView))
    .query(({ ctx, input }) => {
      const { db } = runtime();
      const e = engagementFor(ctx.user, input.engagementId);
      return sourcesFor(db, e).map(({ source, onReturn }) => toView(db, source, onReturn));
    }),

  // Client: "I left that job" / "I closed that account". If it still sent a document for this tax year,
  // it's the final year; if not, it ended the year before and its open requests on this return are withdrawn.
  leave: authedProcedure
    .input(SourceLeaveInput)
    .output(SourceView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const e = engagementFor(ctx.user, input.engagementId);
      const relevant = sourcesFor(db, e).find((x) => x.source.id === input.sourceId);
      if (!relevant) throw notFound("Source");
      const s = relevant.source;
      const lastYear = input.stillExpectDocument ? e.tax_year : e.tax_year - 1;
      if (s.first_year !== null && lastYear < s.first_year) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${s.label} started in ${s.first_year}, so it would still send a ${e.tax_year} document.` });
      }
      db.transaction(() => {
        db.run("UPDATE sources SET last_year = ? WHERE id = ?", [lastYear, s.id]);
        if (!input.stillExpectDocument) {
          const at = now();
          const open = db
            .query<{ id: string }, [string, string]>("SELECT id FROM requests WHERE engagement_id = ? AND source_id = ? AND status = 'open'")
            .all(e.id, s.id);
          for (const r of open) {
            db.run("UPDATE requests SET status = 'cancelled', closed_at = ? WHERE id = ?", [at, r.id]);
            appendEvent(db, { actor: ctx.user, type: "request.cancelled", subjectType: "request", subjectId: r.id, householdId: e.household_id, engagementId: e.id, reason: "Client no longer has this" });
          }
        }
        sourceEvent(db, ctx.user, "source.left", s, { engagementId: e.id, reason: input.note ?? null });
      })();
      return toView(db, sourceRow(db, s.id)!, relevant.onReturn);
    }),
});

// Returning clients: next year's return from last year's, and the day-one checklist.
export const returningRouter = router({
  attachSources: preparerProcedure
    .input(AttachSourcesInput)
    .output(z.object({ attached: z.int() }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const e = engagementFor(ctx.user, input.engagementId);
      let attached = 0;
      db.transaction(() => {
        for (const id of new Set(input.sourceIds)) {
          const s = sourceRow(db, id) ?? (() => { throw notFound("Source"); })();
          assertBelongs(db, e, s);
          if (attach(db, ctx.user, e, s)) attached++;
        }
      })();
      return { attached };
    }),

  detachSource: preparerProcedure
    .input(DetachSourceInput)
    .output(z.object({ ok: z.literal(true) }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const e = engagementFor(ctx.user, input.engagementId);
      const s = sourceRow(db, input.sourceId) ?? (() => { throw notFound("Source"); })();
      const used =
        db.query("SELECT 1 FROM documents WHERE engagement_id = ? AND source_id = ? LIMIT 1").get(e.id, s.id) ||
        db.query("SELECT 1 FROM requests WHERE engagement_id = ? AND source_id = ? LIMIT 1").get(e.id, s.id);
      if (used) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `${s.label} already has requests or documents on this return. Cancel those instead.` });
      db.transaction(() => {
        db.run("DELETE FROM return_sources WHERE engagement_id = ? AND source_id = ?", [e.id, s.id]);
        sourceEvent(db, ctx.user, "source.detached", s, { engagementId: e.id });
      })();
      return { ok: true as const };
    }),

  // A new original return for next year: same household, same people, and last year's sources that are
  // still open carried onto it.
  startFromLastYear: preparerProcedure
    .input(StartFromLastYearInput)
    .output(z.object({ engagementId: z.string(), taxYear: z.int(), sourcesCarried: z.int() }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const last = engagementFor(ctx.user, input.engagementId);
      const kind = db.query<{ kind: string }, [string]>("SELECT kind FROM engagements WHERE id = ?").get(last.id)!.kind;
      if (kind !== "original") throw new TRPCError({ code: "BAD_REQUEST", message: "Start next year from last year's original return, not an amendment." });
      const year = last.tax_year + 1;
      const people = db
        .query<{ person_id: string; role: string; relationship: string | null; months_lived_with: number | null; name: string }, [string]>(
          `SELECT rp.person_id, rp.role, rp.relationship, rp.months_lived_with, p.first_name || ' ' || p.last_name AS name
             FROM return_people rp JOIN people p ON p.id = rp.person_id WHERE rp.engagement_id = ?`,
        )
        .all(last.id);
      for (const p of people) {
        const filer = p.role !== "dependent";
        const clash = db
          .query(
            `SELECT 1 FROM return_people WHERE person_id = ? AND tax_year = ? AND engagement_kind = 'original'
               AND ${filer ? "role IN ('primary', 'spouse')" : "role = 'dependent'"}`,
          )
          .get(p.person_id, year);
        if (clash) {
          throw new TRPCError({ code: "CONFLICT", message: `${p.name} is already on a ${year} return. Open that one instead.` });
        }
      }
      const id = Bun.randomUUIDv7();
      const at = now();
      let carried = 0;
      db.transaction(() => {
        db.run(
          "INSERT INTO engagements (id, household_id, tax_year, kind, stage, stage_changed_at, created_at) VALUES (?, ?, ?, 'original', 'invited', ?, ?)",
          [id, last.household_id, year, at, at],
        );
        for (const p of people) {
          db.run(
            `INSERT INTO return_people (engagement_id, person_id, tax_year, engagement_kind, role, relationship, months_lived_with)
             VALUES (?, ?, ?, 'original', ?, ?, ?)`,
            [id, p.person_id, year, p.role, p.relationship, p.months_lived_with],
          );
        }
        appendEvent(db, {
          actor: ctx.user,
          type: "engagement.created",
          subjectType: "engagement",
          subjectId: id,
          householdId: last.household_id,
          engagementId: id,
          data: { tax_year: year, kind: "original", from_engagement: last.id },
        });
        const next: EngagementRef = { id, household_id: last.household_id, tax_year: year, stage: "invited" };
        const lastSources = db
          .query<SourceRow, [string]>(
            "SELECT s.id, s.household_id, s.kind, s.label, s.first_year, s.last_year FROM return_sources rs JOIN sources s ON s.id = rs.source_id WHERE rs.engagement_id = ?",
          )
          .all(last.id);
        for (const s of lastSources) if (isOpenFor(s, year) && attach(db, ctx.user, next, s)) carried++;
      })();
      return { engagementId: id, taxYear: year, sourcesCarried: carried };
    }),
});

// The day-one checklist: every document each source usually produces, requested once.
// Covers sources already on the return and last year's still-open ones (which get attached).
export const createExpectedProcedure = preparerProcedure
  .input(CreateExpectedInput)
  .output(z.object({ created: z.array(RequestView), skipped: z.int() }))
  .mutation(({ ctx, input }) => {
    const { db } = runtime();
    const e = engagementFor(ctx.user, input.engagementId);
    const onReturn = new Set(
      db.query<{ person_id: string }, [string]>("SELECT person_id FROM return_people WHERE engagement_id = ?").all(e.id).map((r) => r.person_id),
    );
    const createdIds: string[] = [];
    let skipped = 0;
    db.transaction(() => {
      for (const { source } of sourcesFor(db, e)) {
        if (!isOpenFor(source, e.tax_year)) continue;
        attach(db, ctx.user, e, source);
        const owner = ownersOf(db, source.id).find((o) => onReturn.has(o.personId));
        for (const kind of SOURCE_DOCUMENT_KINDS[source.kind]) {
          const already = db
            .query("SELECT 1 FROM requests WHERE engagement_id = ? AND source_id = ? AND document_kind = ? AND status <> 'cancelled'")
            .get(e.id, source.id, kind);
          if (already) {
            skipped++;
            continue;
          }
          const form = db.query<{ form_name: string }, [string]>("SELECT form_name FROM document_kinds WHERE code = ?").get(kind)!.form_name;
          const id = Bun.randomUUIDv7();
          db.run(
            `INSERT INTO requests (id, engagement_id, person_id, source_id, kind, document_kind, title, status, created_by, created_at)
             VALUES (?, ?, ?, ?, 'document', ?, ?, 'open', ?, ?)`,
            [id, e.id, owner?.personId ?? null, source.id, kind, `Upload your ${form} from ${source.label}`, ctx.user.id, now()],
          );
          appendEvent(db, { actor: ctx.user, type: "request.created", subjectType: "request", subjectId: id, householdId: e.household_id, engagementId: e.id, data: { kind: "document", document_kind: kind, expected: true } });
          createdIds.push(id);
        }
      }
    })();
    const all = listRequests(e.id, ctx.user);
    return { created: all.filter((r) => createdIds.includes(r.id)), skipped };
  });
