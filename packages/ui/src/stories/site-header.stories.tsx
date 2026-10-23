import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, CircleQuestionMark, ReceiptText } from "lucide-react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { SiteHeader, SkipLink } from "../components/site-chrome";
import { NAV, START } from "./site-sections.fixtures";

// The marketing site's sticky header (marketing 01, 02): the wordmark back to the top, the section links from `md`, the
// theme toggle and two actions. On phones the sections sit behind one round menu button (14-phone-m-menu); what each
// item does is the page's (onSelect). Invented links.
const meta: Meta = { title: "Site/SiteHeader", parameters: { site: true } };
meta.parameters = { ...meta.parameters, usage: 'import { SiteHeader, SkipLink } from "@app/ui/components/site-chrome";' };
export default meta;
type Story = StoryObj;

const selected = fn();
const items = [
  { label: "Get started", icon: ArrowRight, onSelect: () => selected("start") },
  { label: "Pricing", icon: ReceiptText, onSelect: () => selected("#pricing") },
  { label: "FAQ", icon: CircleQuestionMark, onSelect: () => selected("#faq") },
];
const header = (menuClassName?: string) => (
  <>
    <SkipLink>Skip to content</SkipLink>
    <SiteHeader
      home={{ label: "belltax., back to top", href: "#main" }}
      nav={NAV}
      secondary={{ label: "See the demo", href: "#demo" }}
      primary={{ label: "Get started", href: START }}
      menu={{ label: "Menu", items, className: menuClassName }}
    />
    <main id="main" className="h-96" />
  </>
);

export const Default: Story = { render: () => header() };
export const Phone: Story = { ...Default, name: "Phone (402)", globals: { viewport: { value: "phone", isRotated: false } } };
// The menu button shows at every width here so it can be tested on a desktop canvas.
export const MenuTest: Story = {
  name: "Phone menu · test",
  tags: ["!dev", "!autodocs"],
  render: () => header("md:flex"),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("navigation", { name: "Sections" })).toBeInTheDocument();
    const fab = c.getByRole("button", { name: "Menu" });
    await userEvent.click(fab);
    await expect(fab).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(c.getByRole("menuitem", { name: "Pricing" }));
    await expect(selected).toHaveBeenCalledWith("#pricing");
    await userEvent.click(fab);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(c.queryByRole("menu")).toBeNull());
    await expect(fab).toHaveFocus();
  },
};
