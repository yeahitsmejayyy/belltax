import { FileText } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { Label } from "@app/ui/components/label";
import { Skeleton } from "@app/ui/components/skeleton";
import { Textarea } from "@app/ui/components/textarea";
import { formatDate, formatDateTime } from "@app/ui/format";

import { trpc, type RouterOutputs } from "@/lib/trpc";

import { serverMessage } from "./server-error";

// Settings › Engagement letter (admin 33-settings-settings-letter): the template, merge fields to insert, a live
// preview filled with sample values, and Publish. Publishing adds a version; letters already out keep theirs.

type Template = RouterOutputs["settings"]["letterTemplate"]["get"];
const MIN = 40;

function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Editor({ t }: { t: Template }) {
  const utils = trpc.useUtils();
  const publish = trpc.settings.letterTemplate.publish.useMutation();
  const [body, setBody] = React.useState(t.current.body);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const draft = useDebounced(body.trim());
  const preview = trpc.settings.letterTemplate.preview.useQuery({ body: draft }, { enabled: draft.length >= MIN, placeholderData: (prev) => prev });
  const changed = body.trim() !== t.current.body.trim();
  const tooShort = body.trim().length < MIN;
  const problems = tooShort ? [`A letter needs at least ${MIN} characters.`] : (preview.data?.problems ?? []);

  const insert = (field: string) => {
    const token = `{{${field}}}`;
    const el = ref.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const onPublish = async () => {
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
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Insert a merge field">
        <span className="text-xs text-muted-foreground">Insert</span>
        {t.mergeFields.map((f) => (
          <Button
            key={f}
            type="button"
            variant="outline"
            size="sm"
            className="font-mono text-xs max-md:h-11"
            onClick={() => insert(f)}
            title={t.requiredFields.includes(f) ? "Required in every letter" : undefined}
          >
            {`{{${f}}}`}
            {t.requiredFields.includes(f) ? <span className="sr-only"> (required)</span> : null}
          </Button>
        ))}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="letter-body" className="sr-only">
          Letter template
        </Label>
        <Textarea
          id="letter-body"
          ref={ref}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck
          className="min-h-80 font-mono text-sm leading-relaxed"
          aria-describedby="letter-required"
        />
        <p id="letter-required" className="text-xs text-muted-foreground">
          Every letter must include {t.requiredFields.map((f) => `{{${f}}}`).join(", ")}.
        </p>
      </div>

      <section aria-live="polite" className="grid gap-2">
        <h3 className="text-sm font-semibold">Preview</h3>
        {problems.length ? (
          <Banner tone="warning" title="Fix this before publishing">
            <ul className="list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </Banner>
        ) : preview.data?.rendered ? (
          <div className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-4 text-sm whitespace-pre-wrap">{preview.data.rendered}</div>
        ) : (
          <Skeleton className="h-40 rounded-lg" />
        )}
        <p className="text-xs text-muted-foreground">Filled with invented sample values.</p>
      </section>

      {error ? <Banner tone="danger" title="Not published">{error}</Banner> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onPublish} disabled={!changed || problems.length > 0 || preview.isFetching || publish.isPending} className="max-md:h-11">
          {publish.isPending ? "Publishing…" : `Publish version ${t.current.version + 1}`}
        </Button>
        {changed ? (
          <Button variant="ghost" onClick={() => setBody(t.current.body)} disabled={publish.isPending}>
            Discard changes
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No changes since version {t.current.version}.</span>
        )}
      </div>
    </div>
  );
}

export function LetterTab() {
  const q = trpc.settings.letterTemplate.get.useQuery();
  const t = q.data;
  return (
    <div className="grid max-w-4xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Engagement letter template</CardTitle>
          <CardDescription>
            Merge fields are filled in for each return when you send the letter.
            {t ? ` Version ${t.current.version}, published ${formatDateTime(t.current.createdAt)}${t.current.createdBy ? ` by ${t.current.createdBy}` : ""}.` : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {t ? (
            <Editor key={t.current.version} t={t} />
          ) : q.error ? (
            <Banner tone="danger" title="Couldn't load the template">{q.error.message}</Banner>
          ) : (
            <Skeleton className="h-96 rounded-lg" aria-busy="true" aria-label="Loading the template" />
          )}
        </CardContent>
      </Card>

      {t && t.versions.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Versions</CardTitle>
            <CardDescription>Letters keep the text of the version they were drafted from.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {t.versions.map((v) => (
                <li key={v.version} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
                  <span className="font-medium">Version {v.version}</span>
                  {v.version === t.current.version ? <span className="text-xs text-muted-foreground">(current)</span> : null}
                  <span className="text-muted-foreground">{formatDate(v.createdAt)}</span>
                  <span className="ml-auto text-muted-foreground tabular-nums">
                    {v.letters} {v.letters === 1 ? "letter" : "letters"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
