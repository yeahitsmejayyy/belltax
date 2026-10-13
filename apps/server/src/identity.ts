import { sessionCookie, userForSession } from "./auth/auth";
import { runtime } from "./db/client";

// Who is making this request. The seam real auth (task 05) plugs into: it will replace
// resolveUser() with a session-cookie lookup and nothing downstream changes.
//
// Until then, identity exists in demo mode only: a request names a seeded user with the
// x-demo-user header or the btp_demo_portal / btp_demo_admin cookie (user id or email), and with neither it acts as the demo preparer
// (so the pipeline opens straight in a browser). In live mode there is no identity at all,
// so every non-public procedure answers 401.
//
// Surfaces: the portal listener (the only one a tunnel forwards) and the admin listener (this machine
// only). On the portal a preparer identity is ignored outright, so a preparer credential used from the
// internet gets no further than a stranger would (ticket 23).

export type SessionUser = { id: string; role: "client" | "preparer"; personId: string | null };
export type Surface = "portal" | "admin";

export const DEMO_USER_HEADER = "x-demo-user";
// One cookie per listener. Browsers share cookies across ports on the same host, so a single name
// would let the portal's client identity leak into the admin (and, once auth exists, a session too).
export const demoCookieFor = (surface: Surface) => `btp_demo_${surface}`;

const cookie = (req: Request, name: string) =>
  req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === name)?.[1];

// A signed-in session (ticket 05) comes first, in every mode. The demo identity (header or picker cookie) is the
// fallback, in demo mode only.
export function resolveUser(req: Request, surface: Surface): SessionUser | null {
  const token = cookie(req, sessionCookie(surface));
  if (token) {
    const signedIn = userForSession(decodeURIComponent(token), surface);
    if (signedIn) return signedIn;
  }
  const user = identify(req, surface);
  return user && surface === "portal" && user.role === "preparer" ? null : user;
}

function identify(req: Request, surface: Surface): SessionUser | null {
  const { db, mode } = runtime();
  if (mode !== "demo") return null;
  const asked = req.headers.get(DEMO_USER_HEADER) ?? cookie(req, demoCookieFor(surface));
  if (!asked && surface === "portal") return null; // the demo-preparer default is an admin convenience only
  const row = asked
    ? db.query<{ id: string; role: "client" | "preparer"; person_id: string | null }, [string, string]>("SELECT id, role, person_id FROM users WHERE id = ? OR email = ?").get(decodeURIComponent(asked), decodeURIComponent(asked))
    : db.query<{ id: string; role: "client" | "preparer"; person_id: string | null }, []>("SELECT id, role, person_id FROM users WHERE role = 'preparer' ORDER BY created_at LIMIT 1").get();
  return row ? { id: row.id, role: row.role, personId: row.person_id } : null;
}
