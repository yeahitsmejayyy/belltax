import { WalkthroughSection } from "@app/ui/components/walkthrough";
import * as React from "react";

import { useNames } from "@/lib/public";
import { WALKTHROUGH_COPY, walkthroughPortal, walkthroughSteps } from "@/content/walkthrough";

// How it works (marketing 05 desktop, 16 phone): five steps beside a phone that plays through the portal.
// The script, the copy and the invented household are the site's (content/walkthrough.ts); the design system plays them.

export function How() {
  const names = useNames();
  const steps = React.useMemo(() => walkthroughSteps(names.agent), [names.agent]);
  const portal = React.useMemo(() => walkthroughPortal(names), [names.brand, names.agent, names.Agent]);
  return <WalkthroughSection id="how" steps={steps} portal={portal} copy={WALKTHROUGH_COPY} />;
}
