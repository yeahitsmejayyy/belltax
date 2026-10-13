import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { runtime } from "../db/client";
import { publicProcedure, router } from "../trpc";

// The "sign in as…" picker for walkthroughs. Demo mode only: in live mode this path doesn't exist.
// The portal lists clients (a preparer identity is ignored there anyway); the admin lists the preparer.
// The picker sets the btp_demo_user cookie; real sign-in replaces all of this with auth (ticket 05).

const DemoUser = z.object({ id: z.string(), email: z.string(), role: z.enum(["client", "preparer"]), label: z.string() });

// The public demo's front door (ticket 45): a well-chosen client to show, and whether this is the hosted demo
// (DEMO_PUBLIC), where the front door, hints and role switch appear. The client is the one whose return shows the
// most at once: a rejected document to send again, a letter waiting for a signature, open requests.
const DemoTour = z.object({
  publicDemo: z.boolean(),
  client: z.object({ id: z.string(), name: z.string(), household: z.string() }).nullable(),
  preparerId: z.string().nullable(), // so "See it as the tax agent" signs straight in
});

export const demoRouter = router({
  tour: publicProcedure.output(DemoTour).query(({ path }) => {
    const { db, mode, publicDemo } = runtime();
    if (mode !== "demo") throw new TRPCError({ code: "NOT_FOUND", message: `No procedure found on path "${path}"` });
    const client = db
      .query<{ id: string; name: string; household: string }, []>(
        `SELECT u.id, p.first_name || ' ' || p.last_name AS name, h.display_name AS household
           FROM engagements e
           JOIN return_people rp ON rp.engagement_id = e.id AND rp.role = 'primary'
           JOIN people p ON p.id = rp.person_id
           JOIN users u ON u.person_id = p.id
           JOIN households h ON h.id = e.household_id
           LEFT JOIN engagement_letters l ON l.id = e.letter_id
          WHERE e.stage = 'documents'
          ORDER BY (SELECT COUNT(*) FROM documents d WHERE d.engagement_id = e.id AND d.status = 'rejected') DESC,
                   (l.status = 'sent') DESC,
                   (SELECT COUNT(*) FROM requests r WHERE r.engagement_id = e.id AND r.status = 'open') DESC,
                   e.tax_year DESC, h.display_name
          LIMIT 1`,
      )
      .get();
    const preparer = db.query<{ id: string }, []>("SELECT id FROM users WHERE role = 'preparer' ORDER BY created_at LIMIT 1").get();
    return { publicDemo: !!publicDemo, client: client ?? null, preparerId: preparer?.id ?? null };
  }),

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
