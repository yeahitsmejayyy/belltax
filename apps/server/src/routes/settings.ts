import { TRPCError } from "@trpc/server";
import { FeeUpdateInput, FeeView, LetterTemplateBodyInput, LetterTemplatePreview, LetterTemplateView, now } from "@app/schema";
import { z } from "zod";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import { currentTemplate, MERGE_FIELDS, renderLetter, REQUIRED_FIELDS, templateProblems } from "../letters/template";
import { preparerProcedure, router } from "../trpc";

// Admin settings: the engagement letter template (versioned; publish adds, never edits) and the fee
// schedule (edited in place; issued invoices keep their own copies of amounts).

// Invented values, so a preview never shows anyone real.
const SAMPLE = {
  householdName: "Sample-Household",
  taxYear: 2026,
  amended: false,
  date: "2027-01-15",
  returns: ["Married filing jointly — Alex Sample & Sam Sample"],
  filers: ["Alex Sample", "Sam Sample"],
};

const letterTemplateRouter = router({
  get: preparerProcedure.output(LetterTemplateView).query(() => {
    const { db } = runtime();
    const current = db
      .query<{ version: number; body: string; created_at: string; created_by: string | null }, []>(
        `SELECT t.version, t.body, t.created_at,
                CASE WHEN t.created_by IS NULL THEN NULL ELSE 'Preparer' END AS created_by
           FROM letter_templates t ORDER BY t.version DESC LIMIT 1`,
      )
      .get()!;
    const versions = db
      .query<{ version: number; created_at: string; letters: number }, []>(
        `SELECT t.version, t.created_at, (SELECT COUNT(*) FROM engagement_letters l WHERE l.template_version = t.version) AS letters
           FROM letter_templates t ORDER BY t.version DESC`,
      )
      .all()
      .map((v) => ({ version: v.version, createdAt: v.created_at, letters: v.letters }));
    return {
      current: { version: current.version, body: current.body, createdAt: current.created_at, createdBy: current.created_by },
      versions,
      mergeFields: [...MERGE_FIELDS],
      requiredFields: [...REQUIRED_FIELDS],
    };
  }),

  // Check a draft and show it filled with sample values, without publishing anything.
  preview: preparerProcedure
    .input(LetterTemplateBodyInput)
    .output(LetterTemplatePreview)
    .query(({ input }) => {
      const problems = templateProblems(input.body);
      return { problems, rendered: problems.length ? null : renderLetter({ version: 0, body: input.body }, SAMPLE).body };
    }),

  // A new version. Letters already drafted, sent or signed keep their frozen text and their version.
  publish: preparerProcedure
    .input(LetterTemplateBodyInput)
    .output(z.object({ version: z.int() }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const problems = templateProblems(input.body);
      if (problems.length) throw new TRPCError({ code: "BAD_REQUEST", message: problems.join(" ") });
      const current = currentTemplate(db);
      if (current.body === input.body) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "That's the same as the current version." });
      const version = current.version + 1;
      db.transaction(() => {
        db.run("INSERT INTO letter_templates (version, body, created_at, created_by) VALUES (?, ?, ?, ?)", [version, input.body, now(), ctx.user.id]);
        appendEvent(db, { actor: ctx.user, type: "settings.template_published", subjectType: "letter_template", subjectId: String(version), data: { version } });
      })();
      return { version };
    }),
});

const feesRouter = router({
  list: preparerProcedure.output(z.array(FeeView)).query(() =>
    runtime()
      .db.query<{ code: string; description: string; unit_amount_cents: number; active: number; updated_at: string }, []>(
        "SELECT code, description, unit_amount_cents, active, updated_at FROM fee_schedule ORDER BY position",
      )
      .all()
      .map((f) => ({ code: f.code, description: f.description, unitAmountCents: f.unit_amount_cents, active: f.active === 1, updatedAt: f.updated_at })),
  ),

  update: preparerProcedure
    .input(FeeUpdateInput)
    .output(FeeView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const before = db
        .query<{ description: string; unit_amount_cents: number; active: number }, [string]>("SELECT description, unit_amount_cents, active FROM fee_schedule WHERE code = ?")
        .get(input.code);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Fee not found." });
      const after = {
        description: input.description ?? before.description,
        unit_amount_cents: input.unitAmountCents ?? before.unit_amount_cents,
        active: input.active === undefined ? before.active : input.active ? 1 : 0,
      };
      const at = now();
      db.transaction(() => {
        db.run("UPDATE fee_schedule SET description = ?, unit_amount_cents = ?, active = ?, updated_at = ? WHERE code = ?", [
          after.description, after.unit_amount_cents, after.active, at, input.code,
        ]);
        // Fees aren't personal data, so the change itself is recorded for the audit trail.
        appendEvent(db, {
          actor: ctx.user,
          type: "settings.fee_updated",
          subjectType: "fee",
          subjectId: input.code,
          data: { from_cents: before.unit_amount_cents, to_cents: after.unit_amount_cents, active: after.active === 1 },
        });
      })();
      return { code: input.code, description: after.description, unitAmountCents: after.unit_amount_cents, active: after.active === 1, updatedAt: at };
    }),
});

export const settingsRouter = router({ letterTemplate: letterTemplateRouter, fees: feesRouter });
