import { IconCardsSection } from "@app/ui/components/marketing";

import { PROBLEM } from "@/content/landing";

// The problem (marketing 03): three things that make tax season feel like work.
export function Problem() {
  return <IconCardsSection id="problem" {...PROBLEM} />;
}
