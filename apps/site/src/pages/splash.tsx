import * as React from "react";

import { SplashFooter, SplashHeader, SplashHero } from "@/sections/splash/splash";

// The splash page (ticket 53): what the live domain shows while the practice gets ready to open.
export default function Splash() {
  React.useEffect(() => {
    document.title = "belltax. · Taxes Made Easy. Opening soon";
  }, []);
  return (
    <div className="flex min-h-svh flex-col">
      <SplashHeader />
      <SplashHero />
      <SplashFooter />
    </div>
  );
}
