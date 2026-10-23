import type { EfileJurisdiction, EfileState } from "@app/schema";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { EfileCard } from "../components/efile-card";
import { EFILE_ACCEPTED, EFILE_MIXED, EFILE_NONE } from "./admin-return.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-return-efile-card.stories?raw";

// E-file on a filed return (admin 12-return-overview), the same card apps/admin/src/pages/return/efile-card.tsx
// renders: federal to the IRS, state to the FTB, and what the preparer can record next. A rejection needs its code
// and what it means. The app sends each answer with engagement.recordEfile; here the "server" updates local state.
const meta: Meta<typeof EfileCard> = {
  title: "Admin/Return/EfileCard",
  component: EfileCard,
  parameters: { usage: 'import { EfileCard, EfileRejectDialog } from "@app/ui/components/efile-card";' },
};
export default meta;
type Story = StoryObj<typeof EfileCard>;

const recorded = fn();

function EfileScreen({ start, canRecord = true, refuse }: { start: EfileState[]; canRecord?: boolean; refuse?: string }) {
  const [filings, setFilings] = useState(start);
  const now = () => new Date().toISOString();
  const set = (j: EfileJurisdiction, change: (e: EfileState) => EfileState) => setFilings((all) => all.map((e) => (e.jurisdiction === j ? change(e) : e)));
  return (
    <div className="max-w-xl">
      <EfileCard
        filings={filings}
        canRecord={canRecord}
        onSubmit={(j) => {
          recorded(j, "submit");
          set(j, (e) => ({ ...e, status: "submitted", submittedAt: now(), decidedAt: null, rejectionCode: null, rejectionNote: null, attempts: e.attempts + 1 }));
        }}
        onAccept={(j) => {
          recorded(j, "accept");
          set(j, (e) => ({ ...e, status: "accepted", decidedAt: now() }));
        }}
        onReject={async (j, { rejectionCode, reason }) => {
          await new Promise((r) => setTimeout(r, 200)); // the server
          if (refuse) return refuse;
          recorded(j, "reject", rejectionCode, reason);
          set(j, (e) => ({ ...e, status: "rejected", decidedAt: now(), rejectionCode, rejectionNote: reason }));
        }}
      />
    </div>
  );
}

const source = { docs: { source: { code: fnSource(raw, "EfileScreen") } } };

export const Waiting: Story = { name: "Waiting and rejected", render: () => <EfileScreen start={EFILE_MIXED} />, parameters: source };
export const NotSubmitted: Story = { name: "Not submitted yet", render: () => <EfileScreen start={EFILE_NONE} />, parameters: source };
export const Accepted: Story = { name: "Both accepted (Complete)", render: () => <EfileScreen start={EFILE_ACCEPTED} canRecord={false} />, parameters: source };
export const Refused: Story = { name: "Rejection refused by the server", render: () => <EfileScreen start={EFILE_MIXED} refuse="A rejection needs its code and what it means." />, parameters: source };

export const WaitingTest: Story = {
  ...Waiting,
  name: "Waiting and rejected · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    recorded.mockClear();
    await expect(c.getByText("F540-001-03")).toBeInTheDocument();
    await step("the rejected state return can be submitted again", async () => {
      await userEvent.click(c.getByRole("button", { name: "Submit again" }));
      await expect(recorded).toHaveBeenCalledWith("state", "submit");
      await expect(c.getByText(/attempt 2/)).toBeInTheDocument();
      await expect(c.getAllByText("Waiting for an answer")).toHaveLength(2);
    });
    await step("a rejection needs its code and what it means", async () => {
      await userEvent.click(c.getAllByRole("button", { name: "Record rejected…" })[0]!);
      const dialog = await screen.findByRole("dialog", { name: "Record a federal rejection" });
      await userEvent.click(within(dialog).getByRole("button", { name: "Record rejection" }));
      await expect(within(dialog).getByText("Enter the rejection code.")).toBeInTheDocument();
      await expect(within(dialog).getByText("Say what the rejection means, in a few words.")).toBeInTheDocument();
      await userEvent.type(within(dialog).getByLabelText("Rejection code"), "IND-031-04");
      await userEvent.type(within(dialog).getByLabelText("What it means"), "Prior-year AGI doesn't match the IRS's records.");
      await userEvent.click(within(dialog).getByRole("button", { name: "Record rejection" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await expect(recorded).toHaveBeenCalledWith("federal", "reject", "IND-031-04", "Prior-year AGI doesn't match the IRS's records.");
      await expect(c.getByText("IND-031-04")).toBeInTheDocument();
    });
    await step("then the state answer is recorded as accepted", async () => {
      await userEvent.click(c.getByRole("button", { name: "Record accepted" }));
      await expect(recorded).toHaveBeenCalledWith("state", "accept");
      await expect(c.getByText("Accepted")).toBeInTheDocument();
    });
  },
};

export const RefusedTest: Story = {
  ...Refused,
  name: "Rejection refused by the server · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Record rejected…" }));
    const dialog = await screen.findByRole("dialog", { name: "Record a federal rejection" });
    await userEvent.type(within(dialog).getByLabelText("Rejection code"), "IND-031-04");
    await userEvent.type(within(dialog).getByLabelText("What it means"), "Wrong PIN.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Record rejection" }));
    await expect(await within(dialog).findByText("It wasn't recorded")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

export const AcceptedTest: Story = {
  ...Accepted,
  name: "Both accepted · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getAllByText("Accepted")).toHaveLength(2);
    await expect(c.queryByRole("button")).toBeNull();
  },
};
