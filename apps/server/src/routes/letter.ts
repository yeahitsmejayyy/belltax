import { TRPCError } from "@trpc/server";
import { LetterCreateInput, LetterGetInput, LetterRefInput, LetterSignInput, LetterView, LetterVoidInput, now } from "@app/schema";
import { z } from "zod";
import { engagementFor } from "../access";
import { runtime } from "../db/client";
import { practice } from "./practice";
import { appendEvent, recordView } from "../events";
import type { SessionUser } from "../identity";
import { CONSENT_TEXT, currentTemplate, FILING_STATUS_LABEL, renderLetter, sha256 } from "../letters/template";
import { authedProcedure, preparerProcedure, router } from "../trpc";

// The engagement letter: drafted from the template, sent, signed by every filer on the returns it
// covers, then frozen. The database enforces the frozen text and the hash-bound signature (R21–R24);
// this layer decides who may sign and when.

type LetterRow = {
  id: string;
  household_id: string;
  display_name: string;
  tax_year: number;
  template_version: number;
  body: string;
  body_sha256: string;
  status: "draft" | "sent" | "signed" | "void";
  sent_at: string | null;
  archived_at: string | null;
};

const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "Letter not found." });
const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function loadLetter(letterId: string) {
  return runtime()
    .db.query<LetterRow, [string]>(
      "SELECT l.*, h.display_name FROM engagement_letters l JOIN households h ON h.id = l.household_id WHERE l.id = ?",
    )
    .get(letterId);
}

const coveredReturns = (letterId: string) =>
  runtime()
    .db.query<{ id: string }, [string]>("SELECT id FROM engagements WHERE letter_id = ? ORDER BY created_at, id")
    .all(letterId)
    .map((r) => r.id);

// Clients see a letter once it's out (sent, signed or void), and only if they can open a return it covers.
function letterFor(user: SessionUser, letterId: string): LetterRow {
  const letter = loadLetter(letterId);
  if (!letter) throw notFound();
  if (user.role === "preparer") return letter;
  if (letter.status === "draft") throw notFound();
  const covered = coveredReturns(letterId);
  const { db } = runtime();
  const ok = covered.some((e) => db.query("SELECT 1 FROM client_access WHERE user_id = ? AND engagement_id = ?").get(user.id, e));
  if (!ok) throw notFound();
  return letter;
}

// Everyone who files one of the covered returns signs, in return order.
function signersOf(letterId: string) {
  return runtime()
    .db.query<{ person_id: string; name: string; signed_at: string | null }, [string, string]>(
      `SELECT p.id AS person_id, p.first_name || ' ' || p.last_name AS name, s.signed_at
         FROM engagements e
         JOIN return_people rp ON rp.engagement_id = e.id AND rp.role IN ('primary', 'spouse')
         JOIN people p ON p.id = rp.person_id
         LEFT JOIN signatures s ON s.letter_id = ? AND s.person_id = p.id
        WHERE e.letter_id = ?
        GROUP BY p.id
        ORDER BY MIN(e.created_at), MIN(CASE rp.role WHEN 'primary' THEN 0 ELSE 1 END)`,
    )
    .all(letterId, letterId);
}

function toView(letter: LetterRow, user: SessionUser): LetterView {
  const signers = signersOf(letter.id);
  const me = signers.find((s) => s.person_id === user.personId);
  const audit =
    user.role === "preparer"
      ? runtime()
          .db.query<{ person_id: string; typed_name: string; signed_at: string; ip: string; user_agent: string; body_sha256: string }, [string]>(
            "SELECT person_id, typed_name, signed_at, ip, user_agent, body_sha256 FROM signatures WHERE letter_id = ? ORDER BY signed_at",
          )
          .all(letter.id)
          .map((s) => ({
            personId: s.person_id,
            typedName: s.typed_name,
            signedAt: s.signed_at,
            ip: s.ip,
            userAgent: s.user_agent,
            // An archived letter's text is in the offline record; the signature still names the hash the portal kept.
            hashMatches: s.body_sha256 === (letter.archived_at ? letter.body_sha256 : sha256(letter.body)),
          }))
      : null;
  return {
    id: letter.id,
    status: letter.status,
    householdName: letter.display_name,
    taxYear: letter.tax_year,
    templateVersion: letter.template_version,
    body: letter.body,
    bodySha256: letter.body_sha256,
    sentAt: letter.sent_at,
    archivedAt: letter.archived_at,
    engagementIds: coveredReturns(letter.id),
    consentText: CONSENT_TEXT,
    signers: signers.map((s) => ({ personId: s.person_id, name: s.name, signedAt: s.signed_at, isMe: s.person_id === user.personId })),
    canSign: user.role === "client" && letter.status === "sent" && !!me && !me.signed_at,
    audit,
  };
}

export const letterRouter = router({
  // The letter covering this return, or null if there isn't one the viewer can see yet.
  get: authedProcedure
    .input(LetterGetInput)
    .output(LetterView.nullable())
    .query(({ ctx, input }) => {
      engagementFor(ctx.user, input.engagementId);
      const id = runtime().db.query<{ letter_id: string | null }, [string]>("SELECT letter_id FROM engagements WHERE id = ?").get(input.engagementId)!.letter_id;
      if (!id) return null;
      const letter = loadLetter(id)!;
      if (ctx.user.role === "client" && letter.status === "draft") return null;
      // A client reading their letter is a read of client data; the preparer's reads are covered by engagement.viewed.
      if (ctx.user.role === "client") {
        recordView(runtime().db, { actor: ctx.user, type: "letter.viewed", subjectType: "letter", subjectId: letter.id, householdId: letter.household_id, engagementId: input.engagementId, hourly: true });
      }
      return toView(letter, ctx.user);
    }),

  // Draft a letter from the template for one return, or for a married couple's separate returns together.
  create: preparerProcedure
    .input(LetterCreateInput)
    .output(LetterView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const ids = [...new Set(input.engagementIds)];
      const returns = ids.map((id) => {
        engagementFor(ctx.user, id);
        return db
          .query<{ id: string; household_id: string; display_name: string; tax_year: number; kind: string; filing_status: string | null; letter_id: string | null }, [string]>(
            "SELECT e.id, e.household_id, h.display_name, e.tax_year, e.kind, e.filing_status, e.letter_id FROM engagements e JOIN households h ON h.id = e.household_id WHERE e.id = ?",
          )
          .get(id)!;
      });
      const first = returns[0]!;
      if (returns.some((r) => r.household_id !== first.household_id || r.tax_year !== first.tax_year || r.kind !== first.kind)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "One letter covers returns from the same household, tax year and kind." });
      }
      if (returns.some((r) => r.letter_id)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A return already has a letter. Void it first to replace it." });
      }
      const filersOf = (engagementId: string) =>
        db
          .query<{ name: string }, [string]>(
            `SELECT p.first_name || ' ' || p.last_name AS name FROM return_people rp JOIN people p ON p.id = rp.person_id
              WHERE rp.engagement_id = ? AND rp.role IN ('primary', 'spouse') ORDER BY rp.role`,
          )
          .all(engagementId)
          .map((r) => r.name);
      const allFilers = returns.flatMap((r) => filersOf(r.id));
      if (!allFilers.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Add a primary filer before drafting the letter." });

      const who = practice(db);
      const { body, templateVersion } = renderLetter(currentTemplate(db), {
        practiceName: who.practiceName,
        preparerName: who.preparerName,
        householdName: first.display_name,
        taxYear: first.tax_year,
        amended: first.kind === "amended",
        date: now().slice(0, 10),
        returns: returns.map((r) => `${r.filing_status ? FILING_STATUS_LABEL[r.filing_status] : "Filing status to be confirmed"} — ${filersOf(r.id).join(" & ")}`),
        filers: allFilers,
      });
      const id = Bun.randomUUIDv7();
      db.transaction(() => {
        db.run(
          `INSERT INTO engagement_letters (id, household_id, tax_year, template_version, body, body_sha256, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`,
          [id, first.household_id, first.tax_year, templateVersion, body, sha256(body), now()],
        );
        for (const r of returns) db.run("UPDATE engagements SET letter_id = ? WHERE id = ?", [id, r.id]);
        appendEvent(db, { actor: ctx.user, type: "letter.drafted", subjectType: "engagement_letter", subjectId: id, householdId: first.household_id, data: { returns: returns.length } });
      })();
      return toView(loadLetter(id)!, ctx.user);
    }),

  // Out for signature. From here the text is frozen by the database.
  send: preparerProcedure
    .input(LetterRefInput)
    .output(LetterView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const letter = letterFor(ctx.user, input.letterId);
      if (letter.status !== "draft") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only a draft letter can be sent." });
      db.transaction(() => {
        db.run("UPDATE engagement_letters SET status = 'sent', sent_at = ? WHERE id = ?", [now(), letter.id]);
        appendEvent(db, { actor: ctx.user, type: "letter.sent", subjectType: "engagement_letter", subjectId: letter.id, householdId: letter.household_id });
      })();
      return toView(loadLetter(letter.id)!, ctx.user);
    }),

  // Withdraw a letter (wrong returns, changed terms). Its signatures stay as history; the returns are
  // released so a new letter can be drafted, and the "every filer signed" gate starts over.
  void: preparerProcedure
    .input(LetterVoidInput)
    .output(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      const letter = letterFor(ctx.user, input.letterId);
      if (letter.status === "void") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This letter is already void." });
      db.transaction(() => {
        db.run("UPDATE engagements SET letter_id = NULL WHERE letter_id = ?", [letter.id]);
        db.run("UPDATE engagement_letters SET status = 'void' WHERE id = ?", [letter.id]);
        appendEvent(db, { actor: ctx.user, type: "letter.voided", subjectType: "engagement_letter", subjectId: letter.id, householdId: letter.household_id, reason: input.reason });
      })();
      return { id: letter.id };
    }),

  // A filer signs: typed full name, the consent box, and the hash of the text they read.
  sign: authedProcedure
    .input(LetterSignInput)
    .output(LetterView)
    .mutation(({ ctx, input }) => {
      const { db } = runtime();
      if (ctx.user.role !== "client" || !ctx.user.personId) throw new TRPCError({ code: "FORBIDDEN", message: "Only clients sign engagement letters." });
      const letter = letterFor(ctx.user, input.letterId);
      const me = signersOf(letter.id).find((s) => s.person_id === ctx.user.personId);
      if (!me) throw new TRPCError({ code: "FORBIDDEN", message: "Only the people filing these returns sign this letter." });
      if (me.signed_at) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You've already signed this letter." });
      if (letter.status !== "sent") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This letter isn't out for signature." });
      if (input.bodySha256 !== letter.body_sha256) {
        throw new TRPCError({ code: "CONFLICT", message: "The letter changed since you opened it. Please read it again before signing." });
      }
      if (normalize(input.typedName) !== normalize(me.name)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Type your full name as it appears on the letter: ${me.name}.` });
      }
      const id = Bun.randomUUIDv7();
      db.transaction(() => {
        db.run(
          `INSERT INTO signatures (id, letter_id, person_id, user_id, body_sha256, typed_name, consent_text, ip, user_agent, signed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, letter.id, ctx.user.personId, ctx.user.id, letter.body_sha256, input.typedName.trim(), CONSENT_TEXT, ctx.client.ip, ctx.client.userAgent, now()],
        );
        const unsigned = signersOf(letter.id).filter((s) => !s.signed_at).length;
        if (unsigned === 0) db.run("UPDATE engagement_letters SET status = 'signed' WHERE id = ?", [letter.id]);
        appendEvent(db, {
          actor: ctx.user,
          type: "letter.signed",
          subjectType: "engagement_letter",
          subjectId: letter.id,
          householdId: letter.household_id,
          data: { complete: unsigned === 0 },
        });
      })();
      return toView(loadLetter(letter.id)!, ctx.user);
    }),
});
