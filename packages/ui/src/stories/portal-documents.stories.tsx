import type { Meta, StoryObj } from "@storybook/react-vite";
import { FolderCheck } from "lucide-react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { DocRow, DocumentList, DocumentSection, DocumentsSummary, QuestionCard, RequestRow, SendSomethingElse, SentFile } from "../components/client-documents";
import { EmptyState } from "../components/empty-state";
import { useUploads, type Uploader } from "../components/file-dropzone";
import { fnSource } from "./fixtures";
import { PREPARER, QUESTIONS, REQUESTS, REVIEWED } from "./portal-documents.fixtures";
import raw from "./portal-documents.stories?raw";

// The client portal's Documents screen (portal 13-documents, desktop 23-desktop-d-documents), put together from the
// same components apps/portal/src/pages/documents.tsx renders: the summary, Needed, the preparer's questions, Uploaded,
// something else to send, and Accepted. The uploads here are simulated. Invented data.
const meta: Meta = { title: "Portal/Documents/DocumentsPage" };
meta.parameters = {
  ...meta.parameters,
  usage: 'import { DocRow, DocumentList, DocumentSection, DocumentsSummary, QuestionCard, RequestRow, SendSomethingElse, SentFile } from "@app/ui/components/client-documents";',
};
export default meta;
type Story = StoryObj;

const fakeUpload: Uploader = (_file, onProgress) =>
  new Promise((resolve) => {
    let f = 0;
    const t = setInterval(() => {
      f += 0.25;
      onProgress(f);
      if (f >= 1) {
        clearInterval(t);
        resolve();
      }
    }, 200);
  });

const answered = fn();
const sampled = fn();

function DocumentsScreen({ publicDemo = false }: { publicDemo?: boolean }) {
  const extra = useUploads(fakeUpload);
  const [questions, setQuestions] = useState(QUESTIONS);
  const needed = [REQUESTS.rejected, REQUESTS.needed];
  return (
    <div className="grid w-[48rem] max-w-full grid-cols-1 content-start gap-8">
      <DocumentsSummary accepted={1} needed={needed.length} total={4} />
      <DocumentSection title="Needed" description={`${PREPARER} asked for these. Photos are fine: lay the page flat in good light with all four corners showing.`}>
        <DocumentList label="Needed">
          {needed.map((r) => (
            <RequestRow key={r.id} {...r} preparer={PREPARER} sample={publicDemo ? { pending: false, onClick: sampled } : null} />
          ))}
        </DocumentList>
      </DocumentSection>
      {questions.length ? (
        <DocumentSection title={`${PREPARER} has a question`} description="A sentence or two is plenty.">
          <DocumentList label="Questions">
            {questions.map((q) => (
              <QuestionCard
                key={q.id}
                title={q.title}
                note={q.note}
                onAnswer={(text) => {
                  answered(q.id, text);
                  setQuestions((qs) => qs.filter((x) => x.id !== q.id));
                }}
              />
            ))}
          </DocumentList>
        </DocumentSection>
      ) : null}
      <DocumentSection title="Uploaded" description={`Waiting for ${PREPARER} to check them.`}>
        <DocumentList label="Uploaded">
          <RequestRow {...REQUESTS.uploaded} preparer={PREPARER} />
        </DocumentList>
      </DocumentSection>
      <SendSomethingElse publicDemo={publicDemo} sample={{ pending: false, onClick: sampled }} onFiles={extra.start} uploads={{ items: extra.items, announcement: extra.announcement, onRetry: extra.retry, onRemove: extra.remove }}>
        <DocumentList label="Other things you sent">
          <DocRow title="Letter from the IRS" meta="For you" status="uploaded">
            <SentFile filename="irs-notice-cp2000.pdf" sentAt="2026-02-05T19:00:00.000Z" removable />
          </DocRow>
        </DocumentList>
      </SendSomethingElse>
      <DocumentSection title="Accepted" description="All set. Nothing more to do for these.">
        <DocumentList label="Accepted">
          <RequestRow {...REQUESTS.accepted} files={[REVIEWED]} preparer={PREPARER} />
        </DocumentList>
      </DocumentSection>
    </div>
  );
}

export const Screen: Story = { render: () => <DocumentsScreen />, parameters: { docs: { source: { code: fnSource(raw, "DocumentsScreen") } } } };
export const PublicDemo: Story = { name: "Public demo", render: () => <DocumentsScreen publicDemo />, parameters: Screen.parameters };

export const NothingNeeded: Story = {
  name: "Nothing needed yet",
  render: () => (
    <div className="grid w-[48rem] max-w-full grid-cols-1 content-start gap-8">
      <DocumentsSummary accepted={0} needed={0} total={0} />
      <EmptyState icon={FolderCheck} title="Nothing to upload right now" description={`When ${PREPARER} needs a document from you, it'll show up here.`} />
      <SendSomethingElse onFiles={() => {}} />
    </div>
  ),
};

export const ScreenTest: Story = {
  ...Screen,
  name: "Screen · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    await expect(c.getByText("1 of 4 accepted · 2 still needed from you")).toBeInTheDocument();
    await expect(c.getByRole("progressbar", { name: "1 of 4 documents accepted" })).toBeInTheDocument();
    await step("answering a question sends it and the card leaves the list", async () => {
      const questions = c.getByRole("list", { name: "Questions" });
      const card = within(questions).getByText(QUESTIONS[0]!.title).closest("li")!;
      await userEvent.type(within(card as HTMLElement).getByLabelText("Your answer"), "Yes, in June.");
      await userEvent.click(within(card as HTMLElement).getByRole("button", { name: "Send answer" }));
      await expect(answered).toHaveBeenCalledWith(QUESTIONS[0]!.id, "Yes, in June.");
      await expect(within(questions).queryByText(QUESTIONS[0]!.title)).toBeNull();
    });
  },
};

export const PublicDemoTest: Story = {
  ...PublicDemo,
  name: "Public demo · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Uploads are off in the public demo")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Send a sample" }));
    await expect(sampled).toHaveBeenCalled();
  },
};
