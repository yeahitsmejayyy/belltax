import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { resolveUser } from "./identity";

/**
 * Context
 * Keep this boring, and keep server-only types out of it. The context is part of the AppRouter
 * type that apps/web imports, so anything you put here (a bun:sqlite Database, a Node stream)
 * leaks into a browser app's typecheck. Routes read the database from runtime() instead.
 * The user is plain data, spelled out inline so the emitted contract stays one self-contained file.
 */
export const createContext = ({
  req,
  ip,
}: Pick<FetchCreateContextFnOptions, "req"> & { ip?: string }): {
  user: { id: string; role: "client" | "preparer"; personId: string | null } | null;
  client: { ip: string; userAgent: string };
} => ({
  user: resolveUser(req),
  client: { ip: clientIp(req, ip), userAgent: req.headers.get("user-agent")?.slice(0, 500) || "unknown" },
});

// The socket address, unless the socket is this machine and a local tunnel (cloudflared, Tailscale)
// forwarded the request: then the tunnel's header carries the real client. Recorded on signatures.
function clientIp(req: Request, socketIp?: string) {
  const loopback = !socketIp || socketIp === "127.0.0.1" || socketIp === "::1" || socketIp === "::ffff:127.0.0.1";
  const forwarded = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (loopback && forwarded) || socketIp || "unknown";
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const SIGN_IN_REQUIRED = "Sign-in required.";

// Anyone signed in: clients (limited to their own returns by the access checks) and the preparer.
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: SIGN_IN_REQUIRED });
  return next({ ctx: { user: ctx.user } });
});

export const preparerProcedure = authedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "preparer") throw new TRPCError({ code: "FORBIDDEN", message: "Preparer only." });
  return next();
});
