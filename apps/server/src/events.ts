import type { Database } from "bun:sqlite";
import { now } from "@app/schema";
import type { SessionUser } from "./identity";

// Rule R32: every mutation appends its event inside the same transaction as the change.
// Event data carries ids and state only — never document contents or sensitive values (R33).

export function appendEvent(
  db: Database,
  e: {
    actor: SessionUser | "system" | "stripe";
    type: string;
    subjectType: string;
    subjectId: string;
    householdId?: string | null;
    engagementId?: string | null;
    reason?: string | null;
    data?: Record<string, string | number | boolean | null>;
  },
) {
  const human = typeof e.actor === "object" ? e.actor : null;
  db.run(
    `INSERT INTO events (id, occurred_at, actor_kind, actor_user_id, household_id, engagement_id, type, subject_type, subject_id, reason, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Bun.randomUUIDv7(),
      now(),
      human ? human.role : (e.actor as string),
      human?.id ?? null,
      e.householdId ?? null,
      e.engagementId ?? null,
      e.type,
      e.subjectType,
      e.subjectId,
      e.reason ?? null,
      JSON.stringify(e.data ?? {}),
    ],
  );
}

// Who did it, in words, for timelines and the activity feed. Expects the events table aliased `ev`.
export const ACTOR_NAME_SQL = `CASE ev.actor_kind
    WHEN 'preparer' THEN 'Preparer'
    WHEN 'stripe' THEN 'Stripe'
    WHEN 'system' THEN 'System'
    ELSE COALESCE((SELECT p.first_name || ' ' || p.last_name FROM users u JOIN people p ON p.id = u.person_id WHERE u.id = ev.actor_user_id), 'Client')
  END`;


// Reads of client data (16 CFR 314.4(c)(8), WISP §V.9). A view is an event like any other, typed
// "<thing>.viewed", carrying ids only. `hourly` keeps one per viewer per subject per hour, so a page that
// refetches doesn't bury the log.
export const VIEW_TYPE_SQL = "ev.type GLOB '*.viewed'";

export function recordView(
  db: Database,
  v: { actor: SessionUser; type: `${string}.viewed`; subjectType: string; subjectId: string; householdId: string | null; engagementId?: string | null; hourly?: boolean },
) {
  if (v.hourly) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const seen = db
      .query<{ n: number }, [string, string, string, string]>(
        "SELECT 1 AS n FROM events WHERE subject_id = ? AND type = ? AND occurred_at > ? AND actor_user_id = ? LIMIT 1",
      )
      .get(v.subjectId, v.type, since, v.actor.id);
    if (seen) return;
  }
  appendEvent(db, { actor: v.actor, type: v.type, subjectType: v.subjectType, subjectId: v.subjectId, householdId: v.householdId, engagementId: v.engagementId ?? null });
}
