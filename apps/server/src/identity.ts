import { runtime } from "./db/client";

// Who is making this request. The seam real auth (task 05) plugs into: it will replace
// resolveUser() with a session-cookie lookup and nothing downstream changes.
//
// Until then, identity exists in demo mode only: a request names a seeded user with the
// x-demo-user header or btp_demo_user cookie (user id or email), and with neither it acts as the demo preparer
// (so the pipeline opens straight in a browser). In live mode there is no identity at all,
// so every non-public procedure answers 401.

export type SessionUser = { id: string; role: "client" | "preparer"; personId: string | null };

export const DEMO_USER_HEADER = "x-demo-user";
export const DEMO_USER_COOKIE = "btp_demo_user";

const cookie = (req: Request, name: string) =>
  req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === name)?.[1];

export function resolveUser(req: Request): SessionUser | null {
  const { db, mode } = runtime();
  if (mode !== "demo") return null;
  const asked = req.headers.get(DEMO_USER_HEADER) ?? cookie(req, DEMO_USER_COOKIE);
  const row = asked
    ? db.query<{ id: string; role: "client" | "preparer"; person_id: string | null }, [string, string]>("SELECT id, role, person_id FROM users WHERE id = ? OR email = ?").get(decodeURIComponent(asked), decodeURIComponent(asked))
    : db.query<{ id: string; role: "client" | "preparer"; person_id: string | null }, []>("SELECT id, role, person_id FROM users WHERE role = 'preparer' ORDER BY created_at LIMIT 1").get();
  return row ? { id: row.id, role: row.role, personId: row.person_id } : null;
}
