import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { InvoiceCard } from "../components/client-home";
import { storyLink } from "./client-home.fixtures";

// Home's invoice (ticket 57): what's owed, its state as a chip (due, overdue, paid, payment failed), and the way to it.
// Invented data.
const meta: Meta<typeof InvoiceCard> = {
  title: "Portal/Home/InvoiceCard",
  component: InvoiceCard,
  parameters: { usage: 'import { InvoiceCard } from "@app/ui/components/client-home";' },
  args: { invoice: { settlement: "unpaid", totalCents: 28500, balanceCents: 28500, dueOn: "2099-04-15" }, preparer: "Morgan", to: "/invoice", renderLink: storyLink },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof InvoiceCard>;

export const Due: Story = {};
export const BeforeFiling: Story = { name: "Due before filing", args: { invoice: { settlement: "unpaid", totalCents: 28500, balanceCents: 28500, dueOn: null } } };
export const Paid: Story = { args: { invoice: { settlement: "paid", totalCents: 28500, balanceCents: 0, dueOn: null } } };
export const PaymentFailed: Story = { name: "Payment failed", args: { invoice: { settlement: "failed_last_attempt", totalCents: 28500, balanceCents: 28500, dueOn: null } } };

export const InvoiceCardTest: Story = {
  name: "InvoiceCard · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("link", { name: "View invoice" })).toHaveAttribute("href", "#/invoice");
    await expect(c.getByText("$285.00")).toBeInTheDocument();
  },
};
