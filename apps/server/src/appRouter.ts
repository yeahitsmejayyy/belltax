import { demoRouter } from "./routes/demo";
import { documentRouter } from "./routes/document";
import { engagementRouter } from "./routes/engagement";
import { healthRouter } from "./routes/health";
import { accessRouter, householdRouter, loginRouter, personRouter } from "./routes/household";
import { acknowledgeProcedure, activityRouter, inboxRouter } from "./routes/inbox";
import { intakeRouter } from "./routes/intake";
import { invoiceRouter, paymentRouter } from "./routes/invoice";
import { letterRouter } from "./routes/letter";
import { requestRouter } from "./routes/request";
import { publicPracticeRouter } from "./routes/practice";
import { publicPricingRouter } from "./routes/pricing";
import { seasonRouter } from "./routes/season";
import { settingsRouter } from "./routes/settings";
import { createExpectedProcedure, returningRouter, sourceRouter } from "./routes/source";
import { mergeRouters, router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  demo: demoRouter,
  engagement: mergeRouters(engagementRouter, returningRouter),
  intake: intakeRouter,
  request: mergeRouters(requestRouter, router({ createExpected: createExpectedProcedure, acknowledge: acknowledgeProcedure })),
  source: sourceRouter,
  document: documentRouter,
  letter: letterRouter,
  invoice: invoiceRouter,
  payment: paymentRouter,
  household: householdRouter,
  person: personRouter,
  login: loginRouter,
  access: accessRouter,
  inbox: inboxRouter,
  activity: activityRouter,
  settings: settingsRouter,
  season: seasonRouter,
  pricing: publicPricingRouter,
  practice: publicPracticeRouter,
});

export type AppRouter = typeof appRouter;
