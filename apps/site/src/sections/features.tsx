import { IconCardsSection } from "@app/ui/components/marketing";

import { FEATURES } from "@/content/landing";

// Features (marketing 06): six cards, one per thing the portal does for the client.
export function Features() {
  return <IconCardsSection id="features" tone="brand" {...FEATURES} />;
}
