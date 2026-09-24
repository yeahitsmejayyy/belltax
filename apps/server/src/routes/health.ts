import { PRODUCT_NAME } from "@app/schema";
import { runtime } from "../db/client";
import { publicProcedure, router } from "../trpc";

export const healthRouter = router({
  check: publicProcedure.query(() => ({
    app: PRODUCT_NAME,
    status: "ok" as const,
    mode: runtime().mode,
    timestamp: new Date().toISOString(),
  })),
});
