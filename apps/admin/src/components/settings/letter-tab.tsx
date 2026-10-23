import * as React from "react";
import { toast } from "sonner";

import { LetterTemplateEditor, LetterTemplateSettings } from "@app/ui/components/letter-template";

import { trpc, type RouterOutputs } from "@/lib/trpc";

import { serverMessage } from "./server-error";

// Settings › Engagement letter (admin 33-settings-settings-letter): the template, merge fields to insert, a live
// preview filled with sample values, and Publish. Publishing adds a version; letters already out keep theirs. The
// editor is the design system's; this renders the preview on the server and publishes.

type Template = RouterOutputs["settings"]["letterTemplate"]["get"];
const MIN = 40;

function Editor({ t }: { t: Template }) {
  const utils = trpc.useUtils();
  const publish = trpc.settings.letterTemplate.publish.useMutation();
  const [draft, setDraft] = React.useState(t.current.body.trim());
  const [error, setError] = React.useState<string | null>(null);
  const preview = trpc.settings.letterTemplate.preview.useQuery({ body: draft }, { enabled: draft.length >= MIN, placeholderData: (prev) => prev });

  const onPublish = async (body: string) => {
    setError(null);
    try {
      const r = await publish.mutateAsync({ body });
      await utils.settings.letterTemplate.invalidate();
      toast.success(`Version ${r.version} published`);
    } catch (e) {
      setError(serverMessage(e, "It wasn't published."));
    }
  };

  return (
    <LetterTemplateEditor
      version={t.current.version}
      body={t.current.body}
      mergeFields={t.mergeFields}
      requiredFields={t.requiredFields}
      minLength={MIN}
      preview={preview.data}
      previewing={preview.isFetching}
      publishing={publish.isPending}
      error={error}
      onPreview={setDraft}
      onPublish={(body) => void onPublish(body)}
    />
  );
}

export function LetterTab() {
  const q = trpc.settings.letterTemplate.get.useQuery();
  const t = q.data;
  return (
    <LetterTemplateSettings current={t?.current} versions={t?.versions} loadError={q.error?.message}>
      {t ? <Editor key={t.current.version} t={t} /> : null}
    </LetterTemplateSettings>
  );
}
