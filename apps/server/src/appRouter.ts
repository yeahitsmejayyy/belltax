import { documentRouter } from "./routes/document";
import { engagementRouter } from "./routes/engagement";
import { healthRouter } from "./routes/health";
import { accessRouter, householdRouter, loginRouter, personRouter } from "./routes/household";
import { intakeRouter } from "./routes/intake";
import { invoiceRouter, paymentRouter } from "./routes/invoice";
import { letterRouter } from "./routes/letter";
import { requestRouter } from "./routes/request";
import { router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  engagement: engagementRouter,
  intake: intakeRouter,
  request: requestRouter,
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
