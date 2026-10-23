import type { Meta, StoryObj } from "@storybook/react-vite";

import { SiteFooter } from "../components/site-chrome";
import { BRAND, EMAIL, PLACE } from "./site-sections.fixtures";

// The marketing site's footer (marketing 12): the logo, who and where, then the links a client looks for. Invented details.
const meta: Meta = { title: "Site/SiteFooter", parameters: { site: true } };
meta.parameters = { ...meta.parameters, usage: 'import { SiteFooter } from "@app/ui/components/site-chrome";' };
export default meta;
type Story = StoryObj;

const links = [
  { label: "Client sign in", href: "#sign-in" },
  { label: "FAQ", href: "#faq" },
];

export const Default: Story = { render: () => <SiteFooter name={BRAND} place={PLACE} links={[...links, { label: EMAIL, href: `mailto:${EMAIL}` }]} /> };
// Before the portal answers: no place and no email.
export const Minimal: Story = { render: () => <SiteFooter name={BRAND} links={links} /> };
