import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { OutboxEmpty, OutboxLoading, OutboxNotice, OutboxView } from "../components/outbox";
import { OUTBOX_MESSAGES } from "./admin-lists.fixtures";

// The admin Outbox (ticket 51), put together from the same components apps/admin/src/pages/outbox.tsx renders: the
// note that nothing was sent, the list of emails and the chosen one as the client would see it. Invented data.
const meta: Meta = { title: "Admin/Outbox/OutboxView" };
meta.parameters = {
  ...meta.parameters,
  usage: 'import { OutboxEmpty, OutboxLoading, OutboxNotice, OutboxView } from "@app/ui/components/outbox";',
};
export default meta;
type Story = StoryObj;

export const Screen: Story = {
  render: () => (
    <div className="grid w-[64rem] max-w-full grid-cols-1 gap-6">
      <OutboxNotice />
      <OutboxView messages={OUTBOX_MESSAGES} />
    </div>
  ),
};
export const Empty: Story = { name: "No emails yet", render: () => <OutboxEmpty /> };
export const Loading: Story = { render: () => <OutboxLoading /> };

export const ScreenTest: Story = {
  ...Screen,
  name: "Screen · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    await expect(c.getByTitle(`Email: ${OUTBOX_MESSAGES[0]!.subject}`)).toBeInTheDocument();
    await step("choosing an email shows it", async () => {
      const second = c.getByRole("button", { name: new RegExp(OUTBOX_MESSAGES[1]!.subject) });
      await userEvent.click(second);
      await expect(second).toHaveAttribute("aria-current", "true");
      await expect(c.getByTitle(`Email: ${OUTBOX_MESSAGES[1]!.subject}`)).toBeInTheDocument();
      await expect(c.getByText(OUTBOX_MESSAGES[1]!.to, { selector: "dd" })).toBeInTheDocument();
    });
  },
};
