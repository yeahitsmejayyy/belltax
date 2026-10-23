import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { Button } from "../components/button";
import { RequestDocumentSheet, type RequestDraft } from "../components/request-document-sheet";
import { FILERS, KINDS, PEOPLE } from "./admin-return-documents.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-request-document-sheet.stories?raw";

// Asking the client for something (admin 22-dialogs-and-sheets-sheet-request), the same sheet
// apps/admin/src/pages/return/request-sheet.tsx renders: a document of a known kind (the kinds are a list, grouped by
// category), from one person or the whole household, or a plain question, with an optional note. The "server" is a
// promise here; the app runs request.create. Invented data.
const meta: Meta<typeof RequestDocumentSheet> = {
  title: "Admin/Return/RequestDocumentSheet",
  component: RequestDocumentSheet,
  parameters: { usage: 'import { RequestDocumentSheet, REQUEST_CATEGORIES, type RequestDraft } from "@app/ui/components/request-document-sheet";' },
};
export default meta;
type Story = StoryObj<typeof RequestDocumentSheet>;

const sent = fn();

function RequestScreen({ refuse, loading = false }: { refuse?: string; loading?: boolean }) {
  const [open, setOpen] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (request: RequestDraft) => {
    setError(null);
    setPending(true);
    await new Promise((r) => setTimeout(r, 300)); // the server
    setPending(false);
    if (refuse) return setError(refuse);
    sent(request);
    setOpen(false);
  };
  return (
    <>
      <Button variant="outline" onClick={() => (setOpen(true), setError(null))}>
        Request a document
      </Button>
      <RequestDocumentSheet name={FILERS} open={open} onOpenChange={setOpen} people={PEOPLE} kinds={loading ? [] : KINDS} kindsLoading={loading} pending={pending} error={error} onSubmit={submit} />
    </>
  );
}

const source = { docs: { source: { code: fnSource(raw, "RequestScreen") } } };

export const Sheet: Story = { render: () => <RequestScreen />, parameters: source };
export const Loading: Story = { name: "Kinds loading", render: () => <RequestScreen loading />, parameters: source };
export const Refused: Story = { name: "Refused by the server", render: () => <RequestScreen refuse="This return is filed. Open an amendment to ask for more." />, parameters: source };

export const SheetTest: Story = {
  ...Sheet,
  name: "Request a document · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ step }) => {
    sent.mockClear();
    const s = within(await screen.findByRole("dialog", { name: "Request a document" }));
    // A picked option leaves the page inert for a frame while the list closes.
    const settled = () => waitFor(() => expect(getComputedStyle(s.getByRole("button", { name: "Send request" })).pointerEvents).not.toBe("none"));
    await step("a document has to be chosen", async () => {
      await userEvent.click(s.getByRole("button", { name: "Send request" }));
      await expect(await s.findByText("Choose the document to ask for.")).toBeInTheDocument();
    });
    await step("kind, who it's from and a note go out together", async () => {
      await userEvent.click(s.getByRole("combobox", { name: "Document" }));
      await expect(await screen.findByText("Credits")).toBeInTheDocument();
      await userEvent.click(await screen.findByRole("option", { name: "1098-T Tuition statement" }));
      await settled();
      await userEvent.click(s.getByRole("combobox", { name: "From" }));
      await userEvent.click(await screen.findByRole("option", { name: "Rowan Marigold" }));
      await settled();
      await userEvent.type(s.getByLabelText("Note to the client"), " From the college. ");
      await userEvent.click(s.getByRole("button", { name: "Send request" }));
      await waitFor(() => expect(sent).toHaveBeenCalledWith({ kind: "document", documentKind: "1098_t", personId: "p-rowan", note: "From the college." }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
  },
};
export const QuestionTest: Story = {
  ...Sheet,
  name: "Ask a question · test",
  tags: ["!dev", "!autodocs"],
  play: async () => {
    sent.mockClear();
    const s = within(await screen.findByRole("dialog", { name: "Request a document" }));
    await userEvent.click(s.getByLabelText("A question"));
    await expect(await screen.findByRole("dialog", { name: "Ask a question" })).toBeInTheDocument();
    await userEvent.click(s.getByRole("button", { name: "Send question" }));
    await expect(await s.findByText("Write the question the client should answer.")).toBeInTheDocument();
    await userEvent.type(s.getByLabelText("Question"), "Did you sell any stock this year?");
    await userEvent.click(s.getByRole("button", { name: "Send question" }));
    await waitFor(() => expect(sent).toHaveBeenCalledWith({ kind: "question", title: "Did you sell any stock this year?", personId: undefined, note: undefined }));
  },
};
