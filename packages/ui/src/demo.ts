// Demo-only identity for walkthroughs: which seeded user the browser is acting as. The server reads
// these cookies in demo mode only and ignores them in live mode; real sign-in replaces them (ticket 05).
// One cookie per app, because browsers share cookies across ports on the same host: the portal's
// client identity must never reach the admin.
export type Surface = "portal" | "admin";
const name = (surface: Surface) => `btp_demo_${surface}`;

export function setDemoUser(surface: Surface, userId: string) {
  document.cookie = `${name(surface)}=${encodeURIComponent(userId)}; path=/; SameSite=Lax`;
}

export function clearDemoUser(surface: Surface) {
  document.cookie = `${name(surface)}=; path=/; SameSite=Lax; max-age=0`;
}

export function demoUser(surface: Surface): string | null {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name(surface)}=`));
  return hit ? decodeURIComponent(hit.slice(name(surface).length + 1)) || null : null;
}
