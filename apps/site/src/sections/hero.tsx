import { Hero as HeroSection, HeroPhones } from "@app/ui/components/marketing";

import { bookingYear, stateName, useStartHref } from "@/components/marketing/practice";
import { heroCopy, sellingPoints, START_LABEL } from "@/content/landing";
import { portalSample } from "@/lib/portal-sample";
import { useNames } from "@/lib/public";

// The hero (marketing 01, 02 dark, 13-phone-m-hero): the promise, two actions, and three portal screens drifting below
// (the site's invented sample).
export function Hero() {
  const names = useNames();
  const start = useStartHref();
  const year = bookingYear();
  const region = stateName(names.state);
  const copy = heroCopy({ city: names.city, region, year });
  const sample = portalSample({ ...names, year: year - 1 });
  return (
    <HeroSection
      eyebrow={copy.eyebrow}
      title={copy.title}
      lead={copy.lead}
      primary={{ label: START_LABEL, href: start }}
      secondary={copy.secondary}
      points={sellingPoints(region)}
      credential={copy.credential}
      art={<HeroPhones data={sample} />}
    />
  );
}
