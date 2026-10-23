import { SolutionSection } from "@app/ui/components/marketing";
import { DesktopHome } from "@app/ui/components/portal-mockups";

import { bookingYear } from "@/components/marketing/practice";
import { solutionCopy } from "@/content/landing";
import { portalSample } from "@/lib/portal-sample";
import { useNames } from "@/lib/public";

// The solution (marketing 04): your personal tax agent, one portal, beside the portal home drawn with the site's sample.
export function Solution() {
  const names = useNames();
  return <SolutionSection {...solutionCopy(names)} figure={<DesktopHome data={portalSample({ ...names, year: bookingYear() - 1 })} />} />;
}
