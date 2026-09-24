import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { runtime } from "../db/client";
import { publicProcedure, router } from "../trpc";

// The "sign in as…" picker for walkthroughs. Demo mode only: in live mode this path doesn't exist.
// The portal lists clients (a preparer identity is ignored there anyway); the admin lists the preparer.
// The picker sets the btp_demo_user cookie; real sign-in replaces all of this with auth (ticket 05).

const DemoUser = z.object({ id: z.string(), email: z.string(), role: z.enum(["client", "preparer"]), label: z.string() });

export const demoRouter = router({
  users: publicProcedure.output(z.array(DemoUser)).query(({ ctx, path }) => {
    const { db, mode } = runtime();
    if (mode !== "demo") throw new TRPCError({ code: "NOT_FOUND", message: `No procedure found on path "${path}"` });
    const role = ctx.surface === "admin" ? "preparer" : "client";
    return db
      .query<{ id: string; email: string; role: "client" | "preparer"; label: string }, [string]>(
        `SELECT u.id, u.email, u.role,
                COALESCE(p.first_name || ' ' || p.last_name || COALESCE(' · ' || h.display_name, ''), 'Demo preparer') AS label
           FROM users u LEFT JOIN people p ON p.id = u.person_id LEFT JOIN households h ON h.id = p.household_id
          WHERE u.role = ? ORDER BY h.display_name, p.first_name`,
      )
      .all(role);
  }),
});
