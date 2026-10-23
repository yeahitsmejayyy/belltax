import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { Hero, HeroPhones } from "../components/marketing";
import { POINTS, PORTAL_SAMPLE, START } from "./site-sections.fixtures";

// The marketing site's hero (marketing 01, 02 dark, 13-phone-m-hero): the promise, two actions, the selling points, an
// optional credential and the three portal phones drifting below (decoration, hidden from assistive tech). Invented data.
const meta: Meta = { title: "Site/Hero", parameters: { site: true } };
meta.parameters = { ...meta.parameters, usage: 'import { Hero, HeroPhones } from "@app/ui/components/marketing";' };
export default meta;
type Story = StoryObj;

const copy = {
  eyebrow: "Tax preparation in Los Angeles · Now booking for the 2025 tax year",
  title: "Taxes Made Easy.",
  lead: "Federal and California returns, prepared and e-filed by your personal tax agent. Share your documents, sign and pay, all from your phone.",
  primary: { label: "Get started", href: START },
  secondary: { label: "See how it works", href: "#how" },
};

export const Default: Story = {
  render: () => <Hero {...copy} points={POINTS} credential="CTEC-registered · Bonded · IRS PTIN" art={<HeroPhones data={PORTAL_SAMPLE} />} />,
};
// Outside California: no IHSS point and no credential line.
export const NoCredential: Story = {
  name: "Outside California",
  render: () => <Hero {...copy} lead="Federal and state returns, prepared and e-filed by your personal tax agent." points={POINTS.slice(0, 2)} art={<HeroPhones data={PORTAL_SAMPLE} />} />,
};
export const Phone: Story = { ...Default, name: "Phone (402)", globals: { viewport: { value: "phone", isRotated: false } } };
export const DefaultTest: Story = {
  ...Default,
  name: "Default · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { level: 1, name: "Taxes Made Easy." })).toBeInTheDocument();
    await expect(c.getByRole("link", { name: "Get started" })).toHaveAttribute("href", START);
    await expect(c.getByRole("link", { name: "See how it works" })).toHaveAttribute("href", "#how");
    // The phones are decoration: nothing in them is reachable.
    const art = canvasElement.querySelector("[aria-hidden='true'][inert]");
    await expect(art).not.toBeNull();
  },
};
