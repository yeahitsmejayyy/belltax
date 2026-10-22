import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { ActivityTimeline, StageTimeline } from "../components/timeline";

const meta: Meta = { title: "Admin/Timeline" };
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: "import { ActivityTimeline, StageTimeline } from \"@app/ui/components/timeline\";" };
export default meta;
type Story = StoryObj;

// Portal 05-home-home: where the return stands, in the client's words.
export const ClientProgress: Story = {
  name: "Client progress",
  render: () => <StageTimeline stage="documents" className="w-full max-w-sm" />
};
export const ClientProgressTest: Story = {
  ...ClientProgress,
  name: "Client progress · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const current = within(canvasElement).getAllByRole("listitem").find((li) => li.getAttribute("aria-current") === "step");
    await expect(current).toHaveTextContent("Send your documents");
    await expect(within(canvasElement).getAllByText(/\(done\)/)).toHaveLength(2);
  },
};


// Admin 18-return-activity: newest first, with reasons for anything that went backward.
export const Activity: Story = {
  render: () => (
    <ActivityTimeline
      className="w-full max-w-lg"
      items={[
        { id: "4", at: "2026-09-23T17:04:00.000Z", actor: "Dana Marigold", text: "signed the engagement letter." },
        { id: "3", at: "2026-09-22T15:30:00.000Z", actor: "Preparer", text: "moved the return back to Documents.", reason: "A corrected 1099-NEC is on its way." },
        { id: "2", at: "2026-09-20T09:12:00.000Z", actor: "Sam Marigold", text: "uploaded a W-2 from Harbor Freight Logistics." },
        { id: "1", at: "2026-09-18T18:00:00.000Z", actor: "Preparer", text: "invited the household." },
      ]}
    />
  ),
};
