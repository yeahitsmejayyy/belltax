// Who is on the other end (ticket 25). Live, every request reaches the portal from cloudflared on this machine, so
// the socket says 127.0.0.1 for everyone; the tunnel's header carries the real client. That header is believed only
// when the socket is this machine: from anywhere else it could be forged, and the socket address stands.
// Used for the sign-in throttle, and recorded on signatures.

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function clientIp(req: Request, socketIp?: string) {
  const local = !socketIp || LOOPBACK.has(socketIp);
  const forwarded = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (local && forwarded) || socketIp || "unknown";
}
