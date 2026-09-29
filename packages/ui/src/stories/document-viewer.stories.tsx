import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { DocumentViewer } from "../components/document-viewer";

// Admin 15-return-detail-return-viewer. The page stands in for the PDF the app would embed.
const onAccept = fn();
const onReject = fn();
const meta: Meta<typeof DocumentViewer> = { parameters: { fill: true },
  title: "Product/DocumentViewer",
  component: DocumentViewer,
  args: {
    filename: "w2-harbor-freight-demo.pdf",
    status: "uploaded",
    meta: [
      { label: "Requested", value: "W-2 from Harbor Freight Logistics" },
      { label: "Uploaded by", value: "Sam Marigold · Sep 20, 2026" },
      { label: "Size", value: "412 KB" },
    ],
    children: <div className="aspect-[8.5/11] w-full max-w-md rounded-sm bg-white shadow-md" aria-label="Document preview" role="img" />,
    onAccept,
    onReject,
  },
};
export default meta;
type Story = StoryObj<typeof DocumentViewer>;

export const Review: Story = {
};
export const ReviewTest: Story = {
  ...Review,
  name: "Review · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Accept" }));
    await expect(onAccept).toHaveBeenCalledOnce();
    await userEvent.click(c.getByRole("button", { name: "Reject with reason" }));
    await expect(onReject).toHaveBeenCalledOnce();
  },
};


export const Decided: Story = {
  args: { status: "accepted" }
};
export const DecidedTest: Story = {
  ...Decided,
  name: "Decided · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button", { name: "Accept" })).toBeNull();
  },
};

