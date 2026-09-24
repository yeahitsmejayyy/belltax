import { initTRPC, TRPCError } from "@trpc/server";
import { runtime } from "./db/client";

/**
 * Context
 * Keep this boring, and keep server-only types out of it. The context is part of the AppRouter
 * type that apps/web imports, so anything you put here (a bun:sqlite Database, a Node stream)
 * leaks into a browser app's typecheck. Routes read the database from runtime() instead.
 * Task 05 adds the session here.
 */
export const createContext = () => ({});

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Preparer-only procedures. Until auth lands (task 05) they are open in demo mode, where every
// row is invented, and closed in live mode, where nothing is served without a signed-in preparer.
export const preparerProcedure = t.procedure.use(({ next }) => {
  if (runtime().mode === "live") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign-in required. Preparer access arrives with auth (task 05)." });
  }
  return next();
});
