import type { Meta, StoryObj } from "@storybook/react-vite";

import App from "@/App";
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

import { LOADING, UNAVAILABLE, withPublic } from "./fixtures";

// The marketing site (marketing 01-16), section by section, from the site's own components: what you see here is
// what apps/site renders, with invented practice details and prices (./fixtures). Toggle Light / Dark in the toolbar.
const meta: Meta = { title: "Site/Sections", decorators: [withPublic], parameters: { site: true } };
export default meta;
type Story = StoryObj;

export const FullPage: Story = { name: "Full page", render: () => <App /> };
export const HeaderBar: Story = { name: "Header", render: () => <Header /> };
export const HeroSection: Story = { name: "Hero", render: () => <Hero /> };
export const ProblemSection: Story = { name: "Problem", render: () => <Problem /> };
export const SolutionSection: Story = { name: "Solution", render: () => <Solution /> };
export const HowSection: Story = { name: "How it works", render: () => <How /> };
export const FeaturesSection: Story = { name: "Features", render: () => <Features /> };
export const PricingSection: Story = { name: "Pricing", render: () => <Pricing /> };
// While the portal answers: same-size placeholders, so nothing jumps.
export const PricingLoading: Story = { name: "Pricing · loading", render: () => <Pricing />, parameters: { public: LOADING } };
// The portal can't be reached: no amounts at all, never stale ones.
export const PricingUnavailable: Story = { name: "Pricing · unavailable", render: () => <Pricing />, parameters: { public: UNAVAILABLE } };
export const FaqSection: Story = { name: "FAQ", render: () => <Faq /> };
export const CallToAction: Story = { name: "Call to action", render: () => <Cta /> };
export const FooterBar: Story = { name: "Footer", render: () => <Footer /> };
