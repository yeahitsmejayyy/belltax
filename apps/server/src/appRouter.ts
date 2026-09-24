import { engagementRouter } from "./routes/engagement";
import { healthRouter } from "./routes/health";
import { router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  engagement: engagementRouter,
});

export type AppRouter = typeof appRouter;
