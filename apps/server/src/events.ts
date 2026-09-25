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

