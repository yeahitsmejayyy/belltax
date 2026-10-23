import type { Meta, StoryObj } from "@storybook/react-vite";

import { BillingByPackageCard } from "../components/dashboard";
import { SUMMARY } from "./admin-dashboard.fixtures";

// What's been invoiced this season, one line per package (admin 03-dashboard-dashboard). Invented totals.
const meta: Meta<typeof BillingByPackageCard> = {
  title: "Admin/Dashboard/BillingByPackageCard",
  component: BillingByPackageCard,
  parameters: { usage: 'import { BillingByPackageCard } from "@app/ui/components/dashboard";' },
  decorators: [(Story) => <div className="w-[36rem] max-w-full">{Story()}</div>],
  args: { packages: SUMMARY.billingByPackage },
};
export default meta;
type Story = StoryObj<typeof BillingByPackageCard>;

export const Default: Story = {};
export const NothingYet: Story = { name: "Nothing invoiced yet", args: { packages: [] } };
