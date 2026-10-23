import { SiteHeader } from "@app/ui/components/site-chrome";

import { useStartHref } from "@/components/marketing/practice";
import { DEMO_LABEL, HOME, menuItems, NAV, START_LABEL } from "@/content/landing";
import { portalUrl } from "@/lib/public";

// The sticky header (marketing 01, 02) and, on phones, the round menu button (14-phone-m-menu).
export function Header() {
  const start = useStartHref();
  const demo = portalUrl("/sign-in");
  const go = (href: string) => () => window.location.assign(href);
  return (
    <SiteHeader
      home={HOME}
      nav={NAV}
      secondary={{ label: DEMO_LABEL, href: demo }}
      primary={{ label: START_LABEL, href: start }}
      menu={{ label: "Menu", items: menuItems({ start, demo, go }) }}
    />
  );
}
