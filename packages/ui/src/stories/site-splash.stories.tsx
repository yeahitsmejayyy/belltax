import type { Meta, StoryObj } from "@storybook/react-vite";

import { PortalPhones } from "../components/portal-mockups";
import { SplashFooter, SplashHeader, SplashHero, SplashLayout } from "../components/splash";
import { BRAND, PLACE, POINTS, PORTAL_SAMPLE } from "./site-sections.fixtures";

// The splash page's pieces (ticket 53): a placeholder while the practice gets ready, with no call to action (the
// practice is invite-only). The words, date and place come from the page. Invented details.
const meta: Meta = { title: "Site/SplashPage", parameters: { site: true } };
meta.parameters = { ...meta.parameters, usage: 'import { SplashFooter, SplashHeader, SplashHero, SplashLayout } from "@app/ui/components/splash";' };
export default meta;
type Story = StoryObj;

const hero = (
  <SplashHero
    badge="Opening January 2027 · Los Angeles"
    title="Taxes Made Easy."
    lead="Federal and California returns, prepared and e-filed by our team, with every step in one place on your phone."
    points={POINTS}
    art={<PortalPhones data={PORTAL_SAMPLE} className="mt-4" />}
  />
);

export const Page: Story = {
  render: () => (
    <SplashLayout>
      <SplashHeader />
      {hero}
      <SplashFooter>© 2026 {BRAND} · {PLACE}</SplashFooter>
    </SplashLayout>
  ),
};
export const Phone: Story = { ...Page, name: "Phone (402)", globals: { viewport: { value: "phone", isRotated: false } } };
export const Hero: Story = { render: () => hero };
