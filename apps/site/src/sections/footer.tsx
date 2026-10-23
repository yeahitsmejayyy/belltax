import { SiteFooter } from "@app/ui/components/site-chrome";

import { footerLinks } from "@/content/landing";
import { portalUrl, useNames } from "@/lib/public";

// The footer (marketing 12): who and where, then the three links a client looks for.
export function Footer() {
  const { brand, city, state, email } = useNames();
  return <SiteFooter name={brand} place={[city, state].filter(Boolean).join(", ")} links={footerLinks({ signIn: portalUrl("/sign-in"), email })} />;
}
