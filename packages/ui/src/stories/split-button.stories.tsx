import type { Meta, StoryObj } from "@storybook/react-vite";
import { UserPlus } from "lucide-react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { SplitButton } from "../components/split-button";

const invite = fn();
const addWithout = fn();

const meta: Meta<typeof SplitButton> = {
  title: "Admin/SplitButton",
  component: SplitButton,
  args: {
    label: <><UserPlus /> Invite client</>,
    onClick: invite,
    menuLabel: "More ways to add a client",
    items: [{ label: "Add client without invite", description: "Set up the household now; invite them later.", onSelect: addWithout }],
  },
};
export default meta;
type Story = StoryObj<typeof SplitButton>;

// Reference: .assets/screens/admin/desktop/09-pipeline-invite-menu.png
export const InviteClient: Story = {
  name: "Invite client"
};
export const InviteClientTest: Story = {
  ...InviteClient,
  name: "Invite client · test",
  tags: ["!dev"],
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step("the main part runs the primary action", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Invite client" }));
      await expect(invite).toHaveBeenCalledOnce();
    });
    await step("the chevron opens the menu; choosing an item runs it and closes the menu", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "More ways to add a client" }));
      const item = await screen.findByRole("menuitem", { name: /Add client without invite/ });
      await userEvent.click(item);
      await expect(addWithout).toHaveBeenCalledOnce();
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull()); // after the close animation
    });
    await step("it works from the keyboard", async () => {
      canvas.getByRole("button", { name: "More ways to add a client" }).focus();
      await userEvent.keyboard("{Enter}");
      const menu = await screen.findByRole("menu");
      await waitFor(() => expect(menu).toBeVisible()); // after the open animation
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });
  },
};

