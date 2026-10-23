import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { WalkthroughSection } from "../components/walkthrough";
import { WALKTHROUGH_COPY, WALKTHROUGH_PORTAL, WALKTHROUGH_STEPS } from "./site-walkthrough.fixtures";

// "How it works" on the marketing site (marketing 05 desktop, 16 phone; ticket 60): five steps beside a phone that
// plays a script through mini portal screens. The steps, the screens' words and the controls' labels are config; the
// site passes its own (apps/site/src/content/walkthrough.ts). It pauses on hover, on keyboard focus and off screen,
// and under reduced motion the visitor steps by hand. Invented data.
const meta: Meta<typeof WalkthroughSection> = {
  title: "Site/Walkthrough",
  component: WalkthroughSection,
  parameters: { usage: 'import { WalkthroughSection, type WalkthroughStep, type WalkthroughPortal, type WalkthroughCopy } from "@app/ui/components/walkthrough";' },
  args: { id: "how", steps: WALKTHROUGH_STEPS, portal: WALKTHROUGH_PORTAL, copy: WALKTHROUGH_COPY },
};
export default meta;
type Story = StoryObj<typeof WalkthroughSection>;

export const Section: Story = {};

// Picking a step jumps the phone there; Pause stops it (or, under reduced motion, Next steps on).
export const SectionTest: Story = {
  name: "Section · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "Five steps, all from your phone" })).toBeInTheDocument();
    await expect(c.getByRole("button", { name: /Accept your invite/ })).toHaveAttribute("aria-current", "step");

    await step("picking a step shows its screen", async () => {
      await userEvent.click(c.getByRole("button", { name: /Snap photos of your forms/ }));
      await expect(c.getByRole("button", { name: /Snap photos of your forms/ })).toHaveAttribute("aria-current", "step");
      await expect(c.getByRole("button", { name: /Accept your invite/ })).not.toHaveAttribute("aria-current");
      await expect(c.getByText("Step 3 of 5 · Snap photos of your forms")).toBeInTheDocument();
      await expect(c.getByText("Take a photo")).toBeInTheDocument();
    });

    await step("the controls pause it, or step it by hand", async () => {
      const pause = c.queryByRole("button", { name: "Pause" });
      if (pause) {
        await userEvent.click(pause);
        await expect(c.getByRole("button", { name: "Play" })).toBeInTheDocument();
      } else {
        await userEvent.click(c.getByRole("button", { name: "Next step" }));
        await expect(c.getByText("Step 4 of 5 · Sign your agreement")).toBeInTheDocument();
      }
    });
  },
};
