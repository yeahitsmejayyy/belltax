import type { Meta, StoryObj } from "@storybook/react-vite";

import Splash from "@/pages/splash";
import { SplashFooter, SplashHeader, SplashHero } from "@/sections/splash/splash";

import { UNAVAILABLE, withPublic } from "./fixtures";

// The splash page (ticket 53, from PJ's design export), from the site's own components with invented practice details
// (./fixtures). The live domain shows it with VITE_SITE_PAGE=splash; ?page=landing previews the landing page.
const meta: Meta = { title: "Site/Splash", decorators: [withPublic], parameters: { site: true } };
export default meta;
type Story = StoryObj;

export const FullPage: Story = { name: "Full page", render: () => <Splash /> };
export const HeaderBar: Story = { name: "Header", render: () => <SplashHeader /> };
export const HeroSection: Story = { name: "Hero", render: () => <SplashHero /> };
// No address to write to (the portal can't be reached and no VITE_CONTACT_EMAIL): no form, and the copy says "state".
export const HeroUnavailable: Story = { name: "Hero · no contact address", render: () => <SplashHero />, parameters: { public: UNAVAILABLE } };
export const FooterBar: Story = { name: "Footer", render: () => <SplashFooter /> };
