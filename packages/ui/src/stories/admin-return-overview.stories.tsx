import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { EfileCard } from "../components/efile-card";
import { ReturnOverview } from "../components/return-overview";
import { EFILE_MIXED, INVOICE, INVOICE_FAILED, OPEN_REQUESTS, PEOPLE, PEOPLE_SINGLE, RETURN_FILED, RETURN_PREPARING, RETURN_READY } from "./admin-return.fixtures";

// A return's Overview tab (admin 12-return-detail-return-overview), the same component
// apps/admin/src/pages/return/overview-tab.tsx renders: the checklist in the server's words, open requests, the
// invoice in brief and who's on the return (SSN last four only). E-file comes first once it's filed. Invented data.
const meta: Meta<typeof ReturnOverview> = {
  title: "Admin/Return/ReturnOverview",
  component: ReturnOverview,
  parameters: {
    usage: 'import { ReturnOverview, ChecklistCard, OpenRequestsCard, InvoiceSummaryCard, ReturnPeopleCard } from "@app/ui/components/return-overview";',
  },
  args: { onRequest: fn(), onBilling: fn() },
};
export default meta;
type Story = StoryObj<typeof ReturnOverview>;

export const Preparing: Story = {
  args: { stage: RETURN_PREPARING.stage, nextStage: RETURN_PREPARING.nextStage, blockers: RETURN_PREPARING.blockers, requests: OPEN_REQUESTS, invoice: INVOICE, people: PEOPLE },
};
export const ReadyToMove: Story = {
  name: "Ready to move on",
  args: { stage: RETURN_READY.stage, nextStage: RETURN_READY.nextStage, blockers: [], requests: [], invoice: null, people: PEOPLE },
};
export const Filed: Story = {
  name: "Filed, with E-file",
  args: {
    stage: RETURN_FILED.stage,
    nextStage: RETURN_FILED.nextStage,
    blockers: RETURN_FILED.blockers,
    requests: [],
    invoice: INVOICE_FAILED,
    people: PEOPLE_SINGLE,
    efile: <EfileCard filings={EFILE_MIXED} canRecord onSubmit={() => {}} onAccept={() => {}} onReject={async () => {}} />,
  },
};

export const PreparingTest: Story = {
  ...Preparing,
  name: "Preparing · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await expect(c.getByText("What's needed before it moves to Client review.")).toBeInTheDocument();
    await expect(c.getByText("You rejected it: “The second page is cut off.”")).toBeInTheDocument();
    await expect(c.getByText("“No, same address as last year.”")).toBeInTheDocument();
    await expect(c.getByLabelText("SSN ending 9678")).toHaveTextContent("•••-••-9678");
    await expect(c.getByText("Dependent · Daughter · age 7")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Request a document" }));
    await expect(args.onRequest).toHaveBeenCalled();
    await userEvent.click(c.getByRole("button", { name: "View billing" }));
    await expect(args.onBilling).toHaveBeenCalled();
  },
};

export const ReadyToMoveTest: Story = {
  ...ReadyToMove,
  name: "Ready to move on · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Nothing is holding it in Documents.")).toBeInTheDocument();
    await expect(c.getByText("Nothing open. Everything asked for has come in.")).toBeInTheDocument();
    await expect(c.getByRole("button", { name: "Open billing" })).toBeInTheDocument();
  },
};
