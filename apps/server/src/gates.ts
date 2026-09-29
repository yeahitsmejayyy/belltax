import type { Database } from "bun:sqlite";
import { Stage } from "@app/schema";
import { efileBlockers } from "./efile/efile";

// "What shouldn't happen yet": the workflow rules for moving a return forward one stage.
// The database refuses what must never be true; these are the API's checks (rules R12, R13, R25, R30),
// written as plain sentences because the admin shows them as the reason a move is blocked.

type Check = (db: Database, engagementId: string) => string[];

const q = <T>(db: Database, sql: string, ...p: string[]) => db.query(sql).get(...p) as T;

const GATES: Partial<Record<Stage, Check>> = {
  // invited → intake: someone on the return can sign in
  intake: (db, id) =>
    q<{ n: number }>(
      db,
      `SELECT COUNT(*) AS n FROM return_people rp JOIN users u ON u.person_id = rp.person_id
        WHERE rp.engagement_id = ? AND rp.role IN ('primary', 'spouse')`,
      id,
    ).n > 0
      ? []
      : ["No one on this return has a portal login yet."],

  // intake → documents: a primary filer, and the questionnaire is submitted (R12)
  documents: (db, id) => {
    const out: string[] = [];
    if (!q(db, "SELECT 1 FROM return_people WHERE engagement_id = ? AND role = 'primary'", id)) out.push("The return has no primary filer.");
    if (!q(db, "SELECT 1 FROM intake_responses WHERE engagement_id = ? AND submitted_at IS NOT NULL", id)) out.push("The client hasn't submitted the questionnaire.");
    return out;
  },

  // documents → ready: nothing still being asked for
  ready: (db, id) => {
    const open = q<{ n: number }>(db, "SELECT COUNT(*) AS n FROM requests WHERE engagement_id = ? AND kind = 'document' AND status = 'open'", id).n;
    return open ? [`${open} document request${open === 1 ? " is" : "s are"} still open.`] : [];
  },

  // ready → preparing: filing status settled, spouse iff joint (R13), every filer signed (R25)
  preparing: (db, id) => {
    const out: string[] = [];
    const e = q<{ filing_status: string | null; letter_id: string | null }>(db, "SELECT filing_status, letter_id FROM engagements WHERE id = ?", id);
    const hasSpouse = !!q(db, "SELECT 1 FROM return_people WHERE engagement_id = ? AND role = 'spouse'", id);
    if (!e.filing_status) out.push("Set the filing status.");
    else if (e.filing_status === "mfj" && !hasSpouse) out.push("A joint return needs a spouse on it.");
    else if (e.filing_status !== "mfj" && hasSpouse) out.push("Only a joint return has a spouse on it.");
    if (!e.letter_id) out.push("Send an engagement letter.");
    else {
      const unsigned = q<{ n: number }>(
        db,
        `SELECT COUNT(*) AS n FROM return_people rp
          WHERE rp.engagement_id = ? AND rp.role IN ('primary', 'spouse')
            AND NOT EXISTS (SELECT 1 FROM signatures s WHERE s.letter_id = ? AND s.person_id = rp.person_id)`,
        id,
        e.letter_id,
      ).n;
      if (unsigned) out.push(`${unsigned} filer${unsigned === 1 ? " hasn't" : "s haven't"} signed the engagement letter.`);
    }
    return out;
  },

  // filed → complete: accepted by the IRS and the FTB (ticket 40), and paid in full (R30)
  complete: (db, id) => {
    const due = q<{ due: number }>(db, "SELECT COALESCE(SUM(balance_cents), 0) AS due FROM invoice_balances WHERE engagement_id = ? AND status = 'issued'", id).due;
    return [...efileBlockers(db, id), ...(due > 0 ? [`$${(due / 100).toFixed(2)} is still owed.`] : [])];
  },
};

export const nextStage = (stage: Stage): Stage | null => Stage.options[Stage.options.indexOf(stage) + 1] ?? null;

// What stops this return entering `to`. Empty means it may move.
export const blockersFor = (db: Database, engagementId: string, to: Stage): string[] => GATES[to]?.(db, engagementId) ?? [];
