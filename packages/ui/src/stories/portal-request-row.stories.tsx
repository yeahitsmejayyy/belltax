import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { DocumentList, RequestRow } from "../components/client-documents";
import { PREPARER, REQUESTS } from "./portal-documents.fixtures";

// One document the preparer asked for, on the portal's Documents screen: what, for whom, where it stands, the upload
// (or, in the public demo, a sample) and the files already sent. A rejected file shows the preparer's reason. The app
// does the uploading and removing through `onFiles` and `onRemoveFile`. Invented data.
const meta: Meta<typeof RequestRow> = {
  title: "Portal/Documents/RequestRow",
  component: RequestRow,
  parameters: { usage: 'import { DocumentList, RequestRow } from "@app/ui/components/client-documents";' },
  args: { ...REQUESTS.needed, preparer: PREPARER, onFiles: fn(), onRemoveFile: fn() },
  decorators: [(Story) => <div className="w-[44rem] max-w-full"><DocumentList label="Needed"><Story /></DocumentList></div>],
};
export default meta;
type Story = StoryObj<typeof RequestRow>;

export const Needed: Story = {};
export const Rejected: Story = { args: { ...REQUESTS.rejected } };
export const Uploaded: Story = { name: "Uploaded (waiting to be checked)", args: { ...REQUESTS.uploaded } };
export const Accepted: Story = { args: { ...REQUESTS.accepted } };
export const PublicDemo: Story = { name: "Public demo (sample instead of upload)", args: { ...REQUESTS.rejected, sample: { pending: false, onClick: fn() } } };

export const NeededTest: Story = {
  ...Needed,
  name: "Needed · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, args, step }) => {
    const c = within(canvasElement);
    const input = canvasElement.querySelector("input[type=file]") as HTMLInputElement;
    await expect(c.getByText("For you · Sunny Days Learning Center, all of 2026")).toBeInTheDocument();
    await step("a file we can't take says why and never reaches the app", async () => {
      await userEvent.upload(input, new File(["hello"], "notes.txt", { type: "text/plain" }), { applyAccept: false });
      await expect(c.getByRole("alert")).toHaveTextContent("notes.txt isn't a PDF, JPG, PNG or HEIC file.");
      await expect(args.onFiles).not.toHaveBeenCalled();
    });
    await step("a good file goes to the app", async () => {
      await userEvent.upload(input, new File(["%PDF-1.7 demo"], "childcare-receipt.pdf", { type: "application/pdf" }));
      await expect(args.onFiles).toHaveBeenCalledTimes(1);
      await expect(c.queryByRole("alert")).toBeNull();
    });
  },
};

export const RejectedTest: Story = {
  ...Rejected,
  name: "Rejected · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(`${PREPARER} says: ${REQUESTS.rejected.rejectReason}`)).toBeInTheDocument();
    await expect(c.getByRole("button", { name: "Upload again" })).toBeInTheDocument();
  },
};

export const UploadedTest: Story = {
  ...Uploaded,
  name: "Uploaded · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("button", { name: "Add another file" })).toBeInTheDocument();
    const second = c.getByText("w2-lakeside-page2.jpg").closest("div")!;
    await userEvent.click(within(second as HTMLElement).getByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(args.onRemoveFile).toHaveBeenCalledWith("doc-w2-page2"));
  },
};

export const AcceptedTest: Story = {
  ...Accepted,
  name: "Accepted · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.queryByRole("button", { name: /upload|add another/i })).toBeNull();
    await expect(c.queryByRole("button", { name: "Remove" })).toBeNull();
  },
};

export const PublicDemoTest: Story = {
  ...PublicDemo,
  name: "Public demo · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await expect(canvasElement.querySelector("input[type=file]")).toBeNull();
    await userEvent.click(c.getByRole("button", { name: "Send a sample again" }));
    await expect(args.sample!.onClick).toHaveBeenCalledTimes(1);
  },
};
