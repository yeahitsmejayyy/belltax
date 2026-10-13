// Signing in and out over REST (ticket 05): the server sets and clears an httpOnly session cookie, so these are
// plain fetches, not tRPC. Errors come back as { error } written for the person.
export type AuthResult = { ok: true } | { ok: false; status: number; error: string };

export async function authPost(path: string, body: unknown = {}): Promise<AuthResult> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" }).catch(() => null);
  if (!res) return { ok: false, status: 0, error: "Can't reach the server. Check your connection and try again." };
  if (res.ok) return { ok: true };
  const b = (await res.json().catch(() => null)) as { error?: string } | null;
  return { ok: false, status: res.status, error: b?.error ?? "That didn't work. Try again." };
}

export type LinkInfo = { purpose: "invite" | "reset"; email: string; firstName: string | null; practiceName: string; preparerName: string };
export async function linkInfo(token: string): Promise<LinkInfo | null> {
  const res = await fetch(`/api/auth/link/${token}`).catch(() => null);
  return res?.ok ? ((await res.json()) as LinkInfo) : null;
}

export const signOut = () => authPost("/api/auth/sign-out");
