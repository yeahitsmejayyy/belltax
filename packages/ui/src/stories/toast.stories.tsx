import type { Meta, StoryObj } from "@storybook/react-vite";
import { toast } from "sonner";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import { Button } from "../components/button";
import { Toaster } from "../components/sonner";
import { ThemeProvider } from "../components/theme-provider";

const meta: Meta = { title: "Product/Toast", parameters: { layout: "padded" } };
export default meta;

// Rule 11: every completed action says so, top center.
export const ActionDone: StoryObj = {
  name: "Action done",
  render: () => (
    <ThemeProvider storageKey="btp-storybook-theme">
      <Button onClick={() => toast.success("Letter sent to Dana")}>Send letter</Button>
      <Toaster />
    </ThemeProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Send letter" }));
    const t = await screen.findByText("Letter sent to Dana");
    await waitFor(() => expect(t).toBeVisible()); // after the slide-in
    await expect(t.closest("[data-sonner-toaster]")).toHaveAttribute("data-y-position", "top");
    await expect(t.closest("[data-sonner-toaster]")).toHaveAttribute("data-x-position", "center");
  },
};
