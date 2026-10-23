import { CtaBand } from "@app/ui/components/marketing";

import { useStartHref } from "@/components/marketing/practice";
import { CTA, START_LABEL } from "@/content/landing";

// The closing call to action (marketing 11): the brand band with one button.
export function Cta() {
  const start = useStartHref();
  return <CtaBand title={CTA.title} lead={CTA.lead} action={{ label: START_LABEL, href: start }} />;
}
