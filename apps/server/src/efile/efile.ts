import type { Database } from "bun:sqlite";
import { now, type EfileJurisdiction, type EfileState, type EfileStatus } from "@app/schema";
import type { EngagementRef } from "../access";
import { appendEvent } from "../events";
import type { SessionUser } from "../identity";

// E-file status (migration 008). The preparer records what ProSeries shows: each jurisdiction is submitted,
// then accepted or rejected; a rejection is fixed and submitted again as a new attempt. A return is e-filed
// to both: federal (the IRS) and state (the California FTB).

export const JURISDICTIONS: EfileJurisdiction[] = ["federal", "state"];
export const AUTHORITY: Record<EfileJurisdiction, string> = { federal: "IRS", state: "FTB" };

type Attempt = { id: string; engagement_id: string; jurisdiction: EfileJurisdiction; status: EfileStatus; submitted_at: string; decided_at: string | null; rejection_code: string | null; rejection_note: string | null };

const attemptsFor = (db: Database, engagementId: string) =>
  db
    .query<Attempt, [string]>("SELECT * FROM efile_submissions WHERE engagement_id = ? ORDER BY submitted_at, id")
    .all(engagementId);

// Federal then state: the latest attempt of each, and how many there have been.
export function efileStates(db: Database, engagementId: string): EfileState[] {
  const all = attemptsFor(db, engagementId);
  return JURISDICTIONS.map((jurisdiction) => {
    const mine = all.filter((a) => a.jurisdiction === jurisdiction);
    const last = mine.at(-1);
    return {
      jurisdiction,
      status: last?.status ?? null,
      submittedAt: last?.submitted_at ?? null,
      decidedAt: last?.decided_at ?? null,
      rejectionCode: last?.rejection_code ?? null,
      rejectionNote: last?.rejection_note ?? null,
      attempts: mine.length,
    };
  });
}

// For the pipeline: every return's latest status per jurisdiction, in one query.
export function efileByReturn(db: Database, taxYear: number): Map<string, Record<EfileJurisdiction, EfileStatus | null>> {
  const rows = db
    .query<{ engagement_id: string; jurisdiction: EfileJurisdiction; status: EfileStatus }, [number]>(
      `SELECT s.engagement_id, s.jurisdiction, s.status FROM efile_submissions s JOIN engagements e ON e.id = s.engagement_id
        WHERE e.tax_year = ? AND NOT EXISTS (
          SELECT 1 FROM efile_submissions t WHERE t.engagement_id = s.engagement_id AND t.jurisdiction = s.jurisdiction
             AND (t.submitted_at, t.id) > (s.submitted_at, s.id))`,
    )
    .all(taxYear);
  const out = new Map<string, Record<EfileJurisdiction, EfileStatus | null>>();
  for (const r of rows) {
    const cur = out.get(r.engagement_id) ?? { federal: null, state: null };
    cur[r.jurisdiction] = r.status;
    out.set(r.engagement_id, cur);
  }
  return out;
}

const event = (db: Database, user: SessionUser, e: EngagementRef, type: string, attemptId: string, data: Record<string, string | number | boolean | null>, reason: string | null = null) =>
  appendEvent(db, { actor: user, type, subjectType: "efile_submission", subjectId: attemptId, householdId: e.household_id, engagementId: e.id, reason, data });

// Moving a return to Filed means it was just e-filed: record a submission for each jurisdiction that isn't
// already waiting or accepted. Runs inside the stage change's transaction.
export function submitOnFiling(db: Database, user: SessionUser, e: EngagementRef) {
  for (const s of efileStates(db, e.id)) {
    if (s.status === "submitted" || s.status === "accepted") continue;
    const id = Bun.randomUUIDv7();
    db.run("INSERT INTO efile_submissions (id, engagement_id, jurisdiction, submitted_at) VALUES (?, ?, ?, ?)", [id, e.id, s.jurisdiction, now()]);
    event(db, user, e, "efile.submitted", id, { jurisdiction: s.jurisdiction, resubmission: s.status === "rejected" });
  }
}

export type EfileAction = { jurisdiction: EfileJurisdiction; action: "submit" | "accept" | "reject"; rejectionCode?: string; reason?: string };

// What's wrong with this action right now, in a sentence, or null when it can go ahead.
export function efileProblem(stage: string, current: EfileState, a: EfileAction): string | null {
  const who = AUTHORITY[a.jurisdiction];
  if (stage !== "filed") return "E-file status is recorded while the return is in Filed.";
  if (a.action === "submit") {
    if (current.status === "submitted") return `The ${a.jurisdiction} return is already waiting on the ${who}.`;
    if (current.status === "accepted") return `The ${who} already accepted the ${a.jurisdiction} return.`;
    return null;
  }
  if (current.status !== "submitted") return `There's no ${a.jurisdiction} e-file waiting on the ${who} to answer.`;
  return null;
}

export function recordEfile(db: Database, user: SessionUser, e: EngagementRef, current: EfileState, a: EfileAction) {
  const at = now();
  if (a.action === "submit") {
    const id = Bun.randomUUIDv7();
    db.run("INSERT INTO efile_submissions (id, engagement_id, jurisdiction, submitted_at) VALUES (?, ?, ?, ?)", [id, e.id, a.jurisdiction, at]);
    event(db, user, e, "efile.submitted", id, { jurisdiction: a.jurisdiction, resubmission: current.status === "rejected" });
    return;
  }
  const attempt = db
    .query<{ id: string }, [string, string]>("SELECT id FROM efile_submissions WHERE engagement_id = ? AND jurisdiction = ? AND status = 'submitted'")
    .get(e.id, a.jurisdiction)!;
  if (a.action === "accept") {
    db.run("UPDATE efile_submissions SET status = 'accepted', decided_at = ? WHERE id = ?", [at, attempt.id]);
    event(db, user, e, "efile.accepted", attempt.id, { jurisdiction: a.jurisdiction });
  } else {
    db.run("UPDATE efile_submissions SET status = 'rejected', decided_at = ?, rejection_code = ?, rejection_note = ? WHERE id = ?", [at, a.rejectionCode!, a.reason!, attempt.id]);
    // The code and what it means aren't personal data; they're recorded so the history reads.
    event(db, user, e, "efile.rejected", attempt.id, { jurisdiction: a.jurisdiction, code: a.rejectionCode! }, a.reason!);
  }
}

// filed → complete: every jurisdiction accepted.
export function efileBlockers(db: Database, engagementId: string): string[] {
  return efileStates(db, engagementId).flatMap((s) => {
    const who = AUTHORITY[s.jurisdiction];
    if (s.status === "accepted") return [];
    if (s.status === null) return [`The ${s.jurisdiction} return hasn't been e-filed yet.`];
    if (s.status === "submitted") return [`Waiting on the ${who} to accept the ${s.jurisdiction} return.`];
    return [`The ${who} rejected the ${s.jurisdiction} return (${s.rejectionCode}). Fix it in ProSeries and submit it again.`];
  });
}
