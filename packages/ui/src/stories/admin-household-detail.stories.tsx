import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { HouseholdDetail, type HouseholdDetailData } from "../components/household-detail";
import { ARCHIVED_HOUSEHOLD, EXPORT_RESULT, HOUSEHOLD, NEW_HOUSEHOLD } from "./admin-clients.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-household-detail.stories?raw";

// A household in the preparer admin (admin 28), the same component apps/admin/src/pages/household.tsx renders: its
// people (SSN last four only), returns by year, portal access, and Archive and Export. The links and archiving are
// simulated here; the app runs login.link, login.signOutEverywhere and household.update. Invented data.
const meta: Meta = { title: "Admin/Clients/HouseholdDetail" };
meta.parameters = { ...meta.parameters, usage: 'import { HouseholdDetail } from "@app/ui/components/household-detail";' };
export default meta;
type Story = StoryObj;

const linked = fn();
const signedOut = fn();

function HouseholdScreen({ household: start }: { household: HouseholdDetailData }) {
  const [household, setHousehold] = useState(start);
  return (
    <HouseholdDetail
      household={household}
      onArchive={(archived) => setHousehold((h) => ({ ...h, archivedAt: archived ? new Date().toISOString() : null }))}
      onExport={async () => EXPORT_RESULT}
      onLink={async (login, purpose) => {
        linked(login.userId, purpose);
        return { url: `https://portal.example.test/${purpose}/demo-token-${login.userId}`, emailed: purpose === "reset" };
      }}
      onSignOutEverywhere={async (login) => signedOut(login.userId)}
    />
  );
}

const source = { docs: { source: { code: fnSource(raw, "HouseholdScreen") } } };

export const Screen: Story = { render: () => <HouseholdScreen household={HOUSEHOLD} />, parameters: source };
export const NewHousehold: Story = { name: "Nobody signed in yet", render: () => <HouseholdScreen household={NEW_HOUSEHOLD} />, parameters: source };
export const Archived: Story = { render: () => <HouseholdScreen household={ARCHIVED_HOUSEHOLD} />, parameters: source };
export const Loading: Story = { render: () => <HouseholdDetail onArchive={() => {}} onExport={async () => EXPORT_RESULT} onLink={async () => null} onSignOutEverywhere={async () => {}} /> };
export const CantOpen: Story = {
  name: "Can't be opened",
  render: () => <HouseholdDetail error="No household with that id." onArchive={() => {}} onExport={async () => EXPORT_RESULT} onLink={async () => null} onSignOutEverywhere={async () => {}} />,
};

export const ScreenTest: Story = {
  ...Screen,
  name: "Screen · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    await expect(c.getByText("3 members · client since TY 2025")).toBeInTheDocument();
    await expect(c.getByLabelText("SSN ending 9012")).toHaveTextContent("•••-••-9012");
    await expect(c.getByRole("link", { name: /TY 2026/ })).toHaveAttribute("href", "/returns/e-marigold-2026");
    await step("an invite link for a member who hasn't signed in yet", async () => {
      await userEvent.click(c.getByRole("button", { name: "Invite link" }));
      await expect(linked).toHaveBeenCalledWith("u-sam", "invite");
      await expect(await c.findByText(/It works once, for 7 days\./)).toBeInTheDocument();
    });
    await step("signing a member out everywhere", async () => {
      await userEvent.click(c.getByRole("button", { name: "Sign out everywhere" }));
      await expect(signedOut).toHaveBeenCalledWith("u-dana");
    });
    await step("archiving shows the banner, unarchiving takes it away", async () => {
      await userEvent.click(c.getByRole("button", { name: "Archive" }));
      await expect(c.getByText("It's hidden from Clients unless you show archived households. Nothing was deleted.")).toBeInTheDocument();
      await userEvent.click(c.getByRole("button", { name: "Unarchive" }));
      await expect(c.queryByText("It's hidden from Clients unless you show archived households. Nothing was deleted.")).toBeNull();
    });
  },
};
