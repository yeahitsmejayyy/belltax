import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { FaqSection } from "../components/site-faq";
import { FAQ } from "./site-sections.fixtures";

// The marketing site's questions (marketing 10): a centred intro over a one-open-at-a-time accordion (WAI-ARIA: each
// button in a heading, aria-expanded and aria-controls, closed panels inert). Questions are a config array. Invented copy.
const meta: Meta = { title: "Site/FaqSection", parameters: { site: true } };
meta.parameters = { ...meta.parameters, usage: 'import { Accordion, FaqSection } from "@app/ui/components/site-faq";' };
export default meta;
type Story = StoryObj;

const changed = fn();

export const Default: Story = {
  render: () => <FaqSection eyebrow="Questions" title="Frequently asked questions" items={FAQ} defaultOpen="faq-in-person" onOpenChange={changed} />,
};
export const AllClosed: Story = { name: "All closed", render: () => <FaqSection eyebrow="Questions" title="Frequently asked questions" items={FAQ} /> };

export const DefaultTest: Story = {
  ...Default,
  name: "Default · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    const first = c.getByRole("button", { name: "Do I need to come in person?" });
    const cost = c.getByRole("button", { name: "How much will it cost, and when do I pay?" });
    await step("The default question is open, the rest are closed and inert", async () => {
      await expect(first).toHaveAttribute("aria-expanded", "true");
      await expect(cost).toHaveAttribute("aria-expanded", "false");
      await expect(canvasElement.querySelector("#faq-cost-panel")).toHaveAttribute("inert");
    });
    await step("Opening another closes the first", async () => {
      await userEvent.click(cost);
      await expect(cost).toHaveAttribute("aria-expanded", "true");
      await expect(first).toHaveAttribute("aria-expanded", "false");
      await expect(canvasElement.querySelector("#faq-cost-panel")).not.toHaveAttribute("inert");
      await expect(changed).toHaveBeenLastCalledWith("faq-cost");
    });
    await step("Clicking the open one closes it", async () => {
      await userEvent.click(cost);
      await expect(cost).toHaveAttribute("aria-expanded", "false");
      await expect(changed).toHaveBeenLastCalledWith(null);
    });
  },
};
