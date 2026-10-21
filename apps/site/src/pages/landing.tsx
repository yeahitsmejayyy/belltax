import { Cta } from "@/sections/cta";
import { Faq } from "@/sections/faq";
import { Features } from "@/sections/features";
import { Footer } from "@/sections/footer";
import { Header } from "@/sections/header";
import { Hero } from "@/sections/hero";
import { How } from "@/sections/how";
import { Pricing } from "@/sections/pricing";
import { Problem } from "@/sections/problem";
import { Solution } from "@/sections/solution";

// The landing page (marketing 01-16), in the design's order. Reviews (09) are left out until there are real,
// consented quotes; the component waits in packages/ui stories.
export default function Landing() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Problem />
        <Solution />
        <How />
        <Features />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
