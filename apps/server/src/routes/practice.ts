import type { Database } from "bun:sqlite";
import { now, PracticeUpdateInput, PracticeView, PublicPractice } from "@app/schema";
import { runtime } from "../db/client";
import { appendEvent } from "../events";
import { preparerProcedure, publicProcedure, router } from "../trpc";

// Settings → Practice (admin 31-settings-settings-practice): the practice's own details, stored once and
// used wherever they appear. `practice.public` is the part anyone may see (portal footer, invite email,
// marketing site); the texting number stays with the preparer.

type Row = { practice_name: string; preparer_name: string; preparer_credential: string | null; reply_to_email: string; phone: string | null; city: string | null; state: string | null; updated_at: string };

export function practice(db: Database): PracticeView {
  const r = db.query<Row, []>("SELECT * FROM practice_settings WHERE id = 1").get()!;
  return {
    practiceName: r.practice_name,
    preparerName: r.preparer_name,
    preparerCredential: r.preparer_credential,
    replyToEmail: r.reply_to_email,
    phone: r.phone,
    city: r.city,
    state: r.state,
    updatedAt: r.updated_at,
  };
}

export const settingsPracticeRouter = router({
  get: preparerProcedure.output(PracticeView).query(() => practice(runtime().db)),

  update: preparerProcedure
    .input(PracticeUpdateInput)
    .output(PracticeView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const before = practice(db);
      const after = {
        practiceName: input.practiceName,
        preparerName: input.preparerName,
        preparerCredential: input.preparerCredential ?? null,
        replyToEmail: input.replyToEmail,
        phone: input.phone ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
      };
      const changed = (Object.keys(after) as (keyof typeof after)[]).filter((k) => after[k] !== before[k]);
      if (!changed.length) return before;
      db.transaction(() => {
        db.run(
          `UPDATE practice_settings SET practice_name = ?, preparer_name = ?, preparer_credential = ?, reply_to_email = ?, phone = ?, city = ?, state = ?, updated_at = ?
            WHERE id = 1`,
          [after.practiceName, after.preparerName, after.preparerCredential, after.replyToEmail, after.phone, after.city, after.state, now()],
        );
        // The practice's details aren't client data, so the change is recorded in full.
        appendEvent(db, {
          actor: ctx.user,
          type: "settings.practice_updated",
          subjectType: "practice",
          subjectId: "practice",
          data: Object.fromEntries(changed.flatMap((k) => [[`${k}_from`, before[k]], [`${k}_to`, after[k]]])),
        });
      })();
      return practice(db);
    }),
});

export const publicPracticeRouter = router({
  public: publicProcedure.output(PublicPractice).query(() => {
    const { phone: _private, updatedAt: _when, ...pub } = practice(runtime().db);
    return pub;
  }),
});
