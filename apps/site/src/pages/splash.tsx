import { SplashLayout } from "@app/ui/components/splash";
import * as React from "react";

import { SplashFooter, SplashHeader, SplashHero } from "@/sections/splash/splash";

// The splash page (ticket 53): what the live domain shows while the practice gets ready to open.
export default function Splash() {
  React.useEffect(() => {
    document.title = "belltax. · Taxes Made Easy. Opening soon";
  }, []);
  return (
    <SplashLayout>
      <SplashHeader />
      <SplashHero />
      <SplashFooter />
    </SplashLayout>
  );
}
