import { FileText } from "lucide-react";
import * as React from "react";

import { formatDate, formatDateTime } from "../format";
import { Banner } from "./banner";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Label } from "./label";
import { Skeleton } from "./skeleton";
import { Textarea } from "./textarea";

// Settings › Engagement letter (admin 33-settings-settings-letter): the template, merge fields to insert, a live
// preview filled with sample values, and Publish. Publishing adds a version; letters already out keep theirs.
// Presentational: the template and the rendered preview come in as props; the draft goes out through `onPreview`
// (debounced) and `onPublish`. The admin renders the preview, publishes and toasts.

/** The version being edited: the one published last. */
export type LetterTemplateVersion = { version: number; body: string; createdAt: string; createdBy: string | null };
/** Every published version, and how many letters were drafted from each. */
export type LetterVersionSummary = { version: number; createdAt: string; letters: number };
/** The server's look at a draft: what's wrong with it, or the letter it makes with sample values. */
export type LetterPreview = { problems: string[]; rendered: string | null };

function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * The template editor: merge-field buttons that insert at the cursor, the text, the preview, and Publish. The text is
 * the editor's own from `body` on; give it a `key` of `version` so a publish starts it again. `onPreview` gets the
 * trimmed draft once typing pauses (`debounceMs`); pass back what the server made of it as `preview`.
 */
export function LetterTemplateEditor({
  version,
  body: published,
  mergeFields,
  requiredFields,
  minLength = 40,
  debounceMs = 400,
  preview,
  previewing = false,
  publishing = false,
  error,
  onPreview,
  onPublish,
}: {
  /** The version being edited (Publish makes the next one). */
  version: number;
  /** Its text. */
  body: string;
  /** The fields a letter can use, as buttons, without braces. */
  mergeFields: string[];
  /** The ones every letter must use. */
  requiredFields: string[];
  /** Shorter than this and it isn't a letter: no preview, and Publish waits. */
  minLength?: number;
  debounceMs?: number;
  /** The server's look at the last draft sent to `onPreview`. Undefined until there is one. */
  preview?: LetterPreview;
  /** True while a preview is on its way: Publish waits for it. */
  previewing?: boolean;
  /** True while publishing. */
  publishing?: boolean;
  /** Why the last publish failed. */
  error?: string | null;
  /** The trimmed draft, once typing pauses. */
  onPreview: (draft: string) => void;
  onPublish: (body: string) => void;
}) {
  const [body, setBody] = React.useState(published);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const draft = useDebounced(body.trim(), debounceMs);
  // Once per new draft, whatever `onPreview`'s identity.
  const previewRef = React.useRef(onPreview);
  React.useEffect(() => {
    previewRef.current = onPreview;
  });
  React.useEffect(() => {
    previewRef.current(draft);
  }, [draft]);
  const changed = body.trim() !== published.trim();
  const tooShort = body.trim().length < minLength;
  const problems = tooShort ? [`A letter needs at least ${minLength} characters.`] : (preview?.problems ?? []);

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

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Insert a merge field">
        <span className="text-xs text-muted-foreground">Insert</span>
        {mergeFields.map((f) => (
          <Button
            key={f}
            type="button"
            variant="outline"
            size="sm"
            className="font-mono text-xs max-md:h-11"
            onClick={() => insert(f)}
            title={requiredFields.includes(f) ? "Required in every letter" : undefined}
          >
            {`{{${f}}}`}
            {requiredFields.includes(f) ? <span className="sr-only"> (required)</span> : null}
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
          Every letter must include {requiredFields.map((f) => `{{${f}}}`).join(", ")}.
        </p>
      </div>

      <section aria-live="polite" className="grid gap-2">
        <h3 className="text-sm font-semibold">Preview</h3>
        {problems.length ? (
          <Banner tone="warning" title="Fix this before publishing">
            <ul className="list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </Banner>
        ) : preview?.rendered ? (
          <div className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-4 text-sm whitespace-pre-wrap">{preview.rendered}</div>
        ) : (
          <Skeleton className="h-40 rounded-lg" />
        )}
        <p className="text-xs text-muted-foreground">Filled with invented sample values.</p>
      </section>

      {error ? <Banner tone="danger" title="Not published">{error}</Banner> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => onPublish(body)} disabled={!changed || problems.length > 0 || previewing || publishing} className="max-md:h-11">
          {publishing ? "Publishing…" : `Publish version ${version + 1}`}
        </Button>
        {changed ? (
          <Button variant="ghost" onClick={() => setBody(published)} disabled={publishing}>
            Discard changes
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No changes since version {version}.</span>
        )}
      </div>
    </div>
  );
}

/**
 * Settings › Engagement letter: the template card (its version and who published it, then `children`, the
 * LetterTemplateEditor), and the versions so far once there's more than one. A skeleton until `current` arrives;
 * `loadError` instead when it couldn't be read.
 */
export function LetterTemplateSettings({
  current,
  versions = [],
  loadError,
  children,
}: {
  /** Undefined while loading. */
  current?: LetterTemplateVersion;
  versions?: LetterVersionSummary[];
  loadError?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid max-w-4xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Engagement letter template</CardTitle>
          <CardDescription>
            Merge fields are filled in for each return when you send the letter.
            {current ? ` Version ${current.version}, published ${formatDateTime(current.createdAt)}${current.createdBy ? ` by ${current.createdBy}` : ""}.` : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {current ? (
            children
          ) : loadError ? (
            <Banner tone="danger" title="Couldn't load the template">{loadError}</Banner>
          ) : (
            <Skeleton className="h-96 rounded-lg" aria-busy="true" aria-label="Loading the template" />
          )}
        </CardContent>
      </Card>

      {current && versions.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Versions</CardTitle>
            <CardDescription>Letters keep the text of the version they were drafted from.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {versions.map((v) => (
                <li key={v.version} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
                  <span className="font-medium">Version {v.version}</span>
                  {v.version === current.version ? <span className="text-xs text-muted-foreground">(current)</span> : null}
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
