import { demoRouter } from "./routes/demo";
import { documentRouter } from "./routes/document";
import { engagementRouter } from "./routes/engagement";
import { healthRouter } from "./routes/health";
import { accessRouter, householdRouter, loginRouter, personRouter } from "./routes/household";
import { intakeRouter } from "./routes/intake";
import { invoiceRouter, paymentRouter } from "./routes/invoice";
import { letterRouter } from "./routes/letter";
import { requestRouter } from "./routes/request";
import { createExpectedProcedure, returningRouter, sourceRouter } from "./routes/source";
import { mergeRouters, router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  demo: demoRouter,
  engagement: mergeRouters(engagementRouter, returningRouter),
  intake: intakeRouter,
  request: mergeRouters(requestRouter, router({ createExpected: createExpectedProcedure })),
  source: sourceRouter,
  document: documentRouter,
  letter: letterRouter,
  invoice: invoiceRouter,
  payment: paymentRouter,
  household: householdRouter,
  person: personRouter,
  login: loginRouter,
  access: accessRouter,
});

export type AppRouter = typeof appRouter;
