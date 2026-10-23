import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { LetterTemplateEditor, LetterTemplateSettings, type LetterPreview, type LetterTemplateVersion, type LetterVersionSummary } from "../components/letter-template";
import { LETTER_CURRENT, LETTER_VERSIONS, MERGE_FIELDS, REQUIRED_FIELDS, samplePreview } from "./admin-settings.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-settings-letter.stories?raw";

// Settings › Engagement letter (admin 33-settings-settings-letter): the template, merge fields to insert, a live preview
// filled with invented sample values, and Publish. Publishing adds a version; letters already out keep theirs. The
// preview here is drawn in the story; the admin asks the server. Invented data.
const meta: Meta<typeof LetterTemplateSettings> = { title: "Admin/Settings/LetterTemplateSettings", component: LetterTemplateSettings };
meta.parameters = { ...meta.parameters, usage: 'import { LetterTemplateEditor, LetterTemplateSettings } from "@app/ui/components/letter-template";' };
export default meta;
type Story = StoryObj<typeof LetterTemplateSettings>;

const published = fn();

// The admin's side: a preview for each paused draft, and a publish that makes the next version.
function Letter() {
  const [current, setCurrent] = useState<LetterTemplateVersion>(LETTER_CURRENT);
  const [versions, setVersions] = useState<LetterVersionSummary[]>(LETTER_VERSIONS);
  const [preview, setPreview] = useState<LetterPreview>();
  const [previewing, setPreviewing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const onPreview = (draft: string) => {
    if (draft.length < 40) return;
    setPreviewing(true);
    setTimeout(() => {
      setPreview(samplePreview(draft));
      setPreviewing(false);
    }, 150);
  };
  return (
    <LetterTemplateSettings current={current} versions={versions}>
      <LetterTemplateEditor
        key={current.version}
        version={current.version}
        body={current.body}
        mergeFields={MERGE_FIELDS}
        requiredFields={REQUIRED_FIELDS}
        preview={preview}
        previewing={previewing}
        publishing={publishing}
        onPreview={onPreview}
        onPublish={(body) => {
          published(body);
          setPublishing(true);
          setTimeout(() => {
            const next = { version: current.version + 1, body, createdAt: new Date().toISOString(), createdBy: "Morgan Hale" };
            setCurrent(next);
            setVersions((vs) => [{ version: next.version, createdAt: next.createdAt, letters: 0 }, ...vs]);
            setPublishing(false);
          }, 200);
        }}
      />
    </LetterTemplateSettings>
  );
}

const editor = (preview?: LetterPreview) => (
  <LetterTemplateEditor version={1} body={LETTER_CURRENT.body} mergeFields={MERGE_FIELDS} requiredFields={REQUIRED_FIELDS} preview={preview} onPreview={fn()} onPublish={fn()} />
);

export const Default: Story = { name: "Engagement letter", render: () => <Letter />, parameters: { docs: { source: { code: fnSource(raw, "Letter") } } } };
export const FirstVersion: Story = {
  name: "First version",
  args: { current: { ...LETTER_CURRENT, version: 1 }, versions: [LETTER_VERSIONS[2]!], children: editor(samplePreview(LETTER_CURRENT.body)) },
};
export const Problems: Story = {
  name: "Fix before publishing",
  args: { current: { ...LETTER_CURRENT, version: 1 }, versions: [], children: editor({ problems: ["The letter must include {{fee}}.", "{{refund}} isn't a merge field."], rendered: null }) },
};
export const PublishFailed: Story = {
  name: "Publish failed",
  args: {
    current: LETTER_CURRENT,
    children: <LetterTemplateEditor version={3} body={LETTER_CURRENT.body} mergeFields={MERGE_FIELDS} requiredFields={REQUIRED_FIELDS} preview={samplePreview(LETTER_CURRENT.body)} error="It wasn't published." onPreview={fn()} onPublish={fn()} />,
  },
};
export const Loading: Story = { name: "Loading", args: {} };
export const LoadFailed: Story = { name: "Couldn't load", args: { loadError: "The server didn't answer." } };

export const LetterTemplateSettingsTest: Story = {
  ...Default,
  name: "Engagement letter · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    published.mockClear();
    const c = within(canvasElement);
    const text = c.getByLabelText("Letter template");
    const publish = () => c.getByRole("button", { name: /^Publish version/ });
    // Unchanged: the preview fills in, and there's nothing to publish.
    await expect(await c.findByText(/Dear Avery and Sam Quillfeather/)).toBeInTheDocument();
    await expect(publish()).toBeDisabled();
    // Too short: say so, and Publish waits.
    await userEvent.clear(text);
    await userEvent.type(text, "Too short.");
    await expect(c.getByText("A letter needs at least 40 characters.")).toBeInTheDocument();
    await expect(publish()).toBeDisabled();
    await userEvent.click(c.getByRole("button", { name: "Discard changes" }));
    await expect(c.getByText("No changes since version 3.")).toBeInTheDocument();
    // A merge field goes in at the cursor, the preview catches up, and Publish sends the whole text.
    const end = LETTER_CURRENT.body.length;
    await userEvent.type(text, " Signed for ", { initialSelectionStart: end, initialSelectionEnd: end });
    await userEvent.click(c.getByRole("button", { name: "{{practice_name}}" }));
    await expect(text).toHaveValue(`${LETTER_CURRENT.body} Signed for {{practice_name}}`);
    await expect(await c.findByText(/Signed for Bell Tax/)).toBeInTheDocument();
    await waitFor(() => expect(publish()).toBeEnabled());
    await userEvent.click(publish());
    await expect(published).toHaveBeenCalledWith(`${LETTER_CURRENT.body} Signed for {{practice_name}}`);
    await expect(await c.findByText("No changes since version 4.")).toBeInTheDocument();
    await expect(c.getByRole("button", { name: "Publish version 5" })).toBeDisabled();
  },
};
