import { PortalPhones } from "@app/ui/components/portal-mockups";
import { SplashFooter as Footer, SplashHero as Hero } from "@app/ui/components/splash";

import { bookingYear, stateName } from "@/components/marketing/practice";
import { sellingPoints, splashCopy } from "@/content/splash";
import { portalSample } from "@/lib/portal-sample";
import { BRAND, useNames } from "@/lib/public";

// The splash page's sections (ticket 53), wired to the site's words and the practice's city and state (useNames()).

export { SplashHeader } from "@app/ui/components/splash";

export function SplashHero() {
  const names = useNames();
  const region = stateName(names.state);
  const year = bookingYear();
  const copy = splashCopy({ city: names.city, region });
  return <Hero {...copy} points={sellingPoints(region)} art={<PortalPhones data={portalSample({ ...names, year: year - 1 })} className="mt-4" />} />;
}

export function SplashFooter() {
  const { city, state } = useNames();
  const place = [city, state].filter(Boolean).join(", ");
  return <Footer>{`© ${new Date().getFullYear()} ${BRAND}${place ? ` · ${place}` : ""}`}</Footer>;
}
