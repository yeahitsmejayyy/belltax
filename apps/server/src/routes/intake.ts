import { TRPCError } from "@trpc/server";
import { INTAKE_FORM_VERSION, IntakeAnswers, IntakeGetInput, IntakeSaveInput, IntakeView, missingRequired, now } from "@app/schema";
import { engagementFor } from "../access";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import { authedProcedure, router } from "../trpc";

type Row = { engagement_id: string; form_version: number; answers: string; updated_at: string; submitted_at: string | null };

const toView = (r: Row): IntakeView => {
  const answers = IntakeAnswers.parse(JSON.parse(r.answers));
  return {
    engagementId: r.engagement_id,
    formVersion: r.form_version,
    answers,
    updatedAt: r.updated_at,
    submittedAt: r.submitted_at,
    missing: missingRequired(answers).map((q) => q.id),
  };
};

// Send-only (ticket 52): after submission a client's view keeps the dates and drops the answers. The preparer sees all.
const forUser = (view: IntakeView, role: "client" | "preparer"): IntakeView =>
  role === "client" && view.submittedAt ? { ...view, answers: {}, missing: [] } : view;

export const readIntake = (engagementId: string): IntakeView | null => {
  const row = read(engagementId);
  return row ? toView(row) : null;
};

const read = (engagementId: string) =>
  runtime().db.query<Row, [string]>("SELECT * FROM intake_responses WHERE engagement_id = ?").get(engagementId);

export const intakeRouter = router({
  get: authedProcedure
    .input(IntakeGetInput)
    .output(IntakeView.nullable())
    .query(({ ctx, input }) => {
      engagementFor(ctx.user, input.engagementId);
      const row = read(input.engagementId);
      return row ? forUser(toView(row), ctx.user.role) : null;
    }),

  // Each step saves only its own fields; they're merged over what's already there.
  // Submitting locks it for the client; the preparer can still correct it.
  save: authedProcedure
    .input(IntakeSaveInput)
    .output(IntakeView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const eng = engagementFor(ctx.user, input.engagementId);
      const existing = read(eng.id);
      if (ctx.user.role === "client") {
        if (existing?.submitted_at) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Your answers are already submitted. Ask your preparer to reopen them." });
        }
        if (!["invited", "intake", "documents"].includes(eng.stage)) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This return is past the questionnaire stage." });
        }
      }
      const kept: Record<string, unknown> = existing ? JSON.parse(existing.answers) : {};
      for (const key of input.clear ?? []) delete kept[key];
      const merged = IntakeAnswers.parse({ ...kept, ...input.answers });
      // Submitting needs every required question the client can see. Answers to questions a later
      // choice hid are kept but ignored.
      if (input.submit && !existing?.submitted_at) {
        const missing = missingRequired(merged);
        if (missing.length) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Still to answer: ${missing.map((q) => q.label).join(" · ")}` });
        }
      }
      const at = now();
      const submittedAt = existing?.submitted_at ?? (input.submit ? at : null);

      db.transaction(() => {
        db.run(
          `INSERT INTO intake_responses (engagement_id, form_version, answers, updated_at, submitted_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (engagement_id) DO UPDATE SET answers = excluded.answers, updated_at = excluded.updated_at, submitted_at = excluded.submitted_at`,
          [eng.id, existing?.form_version ?? INTAKE_FORM_VERSION, JSON.stringify(merged), at, submittedAt],
        );
        appendEvent(db, {
          actor: ctx.user,
          type: input.submit && !existing?.submitted_at ? "intake.submitted" : "intake.saved",
          subjectType: "intake",
          subjectId: eng.id,
          householdId: eng.household_id,
          engagementId: eng.id,
          data: { fields: Object.keys(input.answers).length, cleared: input.clear?.length ?? 0 },
        });
      })();
      return forUser(toView(read(eng.id)!), ctx.user.role);
    }),
});
