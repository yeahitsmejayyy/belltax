import { FaqSection } from "@app/ui/components/site-faq";

import { FAQ, faqItems } from "@/content/landing";
import { useNames } from "@/lib/public";

// FAQ (marketing 10-desktop-faq). What the copy calls the preparer comes from useNames().
export function Faq() {
  const { agent } = useNames();
  return <FaqSection eyebrow={FAQ.eyebrow} title={FAQ.title} items={faqItems(agent)} defaultOpen={FAQ.defaultOpen} />;
}
