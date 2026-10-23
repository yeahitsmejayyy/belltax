import * as React from "react";

import { Banner } from "./banner";
import { Button } from "./button";
import { Field, useFieldValidation } from "./field";
import { Label } from "./label";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "./select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "./sheet";
import { Textarea } from "./textarea";

// Asking the client for something (admin 22-dialogs-and-sheets-sheet-request), the sheet apps/admin's return page
// renders and Storybook shows (ticket 59): a document of a known kind, from one person or the whole household, or a
// plain question. It lands on the client's Documents list. The kinds come in as a list (the app reads
// request.documentKinds), grouped by category; sending goes out through `onSubmit`, the app does the mutation.

/** A document kind the client can be asked for. */
export type RequestDocumentKind = { code: string; label: string; category: string };

/** Someone on the return the request can be for. */
export type RequestPerson = { personId: string; firstName: string; lastName: string };

/** What the sheet sends: a document by kind, or a question. No `personId` means the whole household. */
export type RequestDraft =
  | { kind: "document"; documentKind: string; personId?: string; note?: string }
  | { kind: "question"; title: string; personId?: string; note?: string };

/** How each kind's category reads as a group heading. A category not listed shows as its code. */
export const REQUEST_CATEGORIES: Record<string, string> = {
  income: "Income",
  deduction: "Deductions",
  credit: "Credits",
  identity: "Identity",
  prior_year: "Prior year",
  property: "Property",
  business: "Business",
  other: "Other",
};

const HOUSEHOLD = "household";

export type RequestDocumentSheetProps = {
  /** Who it's going to, as the description reads ("Dana & Sam Marigold"). */
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The people it can be for; "Whole household" is always first. */
  people: RequestPerson[];
  /** The kinds to choose from, in order; grouped by `category`. */
  kinds: RequestDocumentKind[];
  /** The kinds are still loading: the picker says so. */
  kindsLoading?: boolean;
  /** Group headings by category code. */
  categories?: Record<string, string>;
  /** The request is being sent: the buttons wait and the sheet can't be dismissed. */
  pending?: boolean;
  /** The server's words when it refused. */
  error?: string | null;
  /** Gets the valid request; the app sends it and closes the sheet. */
  onSubmit: (request: RequestDraft) => void;
};

/** The Request a document sheet. Every time it opens it starts over: a document, from the whole household, no note. */
export function RequestDocumentSheet({ name, open, onOpenChange, people, kinds, kindsLoading = false, categories = REQUEST_CATEGORIES, pending = false, error, onSubmit }: RequestDocumentSheetProps) {
  const [kind, setKind] = React.useState<"document" | "question">("document");
  const [docKind, setDocKind] = React.useState("");
  const [docKindError, setDocKindError] = React.useState<string | null>(null);
  const [who, setWho] = React.useState(HOUSEHOLD);
  const [note, setNote] = React.useState("");
  const question = useFieldValidation(React.useCallback((v: string) => (v.trim() ? null : "Write the question the client should answer."), []));

  React.useEffect(() => {
    if (!open) return;
    setKind("document");
    setDocKind("");
    setDocKindError(null);
    setWho(HOUSEHOLD);
    setNote("");
    question.setValue("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const groups = React.useMemo(() => {
    const by = new Map<string, RequestDocumentKind[]>();
    for (const k of kinds) by.set(k.category, [...(by.get(k.category) ?? []), k]);
    return [...by.entries()];
  }, [kinds]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const personId = who === HOUSEHOLD ? undefined : who;
    const trimmedNote = note.trim() || undefined;
    if (kind === "document" && !docKind) return setDocKindError("Choose the document to ask for.");
    if (kind === "question" && !question.validateNow()) return;
    onSubmit(kind === "document" ? { kind, documentKind: docKind, personId, note: trimmedNote } : { kind, title: question.value.trim(), personId, note: trimmedNote });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <SheetContent className="w-full sm:max-w-md">
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>{kind === "document" ? "Request a document" : "Ask a question"}</SheetTitle>
            <SheetDescription>{name}. The client sees it on their Documents list.</SheetDescription>
          </SheetHeader>

          <div className="grid flex-1 content-start gap-5 overflow-y-auto px-4">
            <RadioGroup value={kind} onValueChange={(v) => setKind(v as "document" | "question")} className="flex gap-4" aria-label="What to ask for">
              <Label className="min-h-11 md:min-h-0">
                <RadioGroupItem value="document" /> A document
              </Label>
              <Label className="min-h-11 md:min-h-0">
                <RadioGroupItem value="question" /> A question
              </Label>
            </RadioGroup>

            {kind === "document" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="request-kind">Document</Label>
                <Select
                  value={docKind}
                  onValueChange={(v) => {
                    setDocKind(v);
                    setDocKindError(null);
                  }}
                >
                  <SelectTrigger id="request-kind" className="w-full max-md:h-11" aria-invalid={docKindError ? true : undefined}>
                    <SelectValue placeholder={kindsLoading ? "Loading…" : "Choose a document"} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(([cat, items]) => (
                      <SelectGroup key={cat}>
                        <SelectLabel>{categories[cat] ?? cat}</SelectLabel>
                        {items.map((k) => (
                          <SelectItem key={k.code} value={k.code}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {docKindError ? (
                  <p role="alert" className="text-sm text-danger-foreground">
                    {docKindError}
                  </p>
                ) : null}
              </div>
            ) : (
              <Field label="Question" placeholder="Did you sell any stock this year?" {...question.inputProps} error={question.error} />
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="request-who">{kind === "document" ? "From" : "For"}</Label>
              <Select value={who} onValueChange={setWho}>
                <SelectTrigger id="request-who" className="w-full max-md:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={HOUSEHOLD}>Whole household</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.personId} value={p.personId}>
                      {p.firstName} {p.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="request-note">Note to the client</Label>
              <Textarea id="request-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Optional. For example: the one from your side job." />
            </div>

            {error ? <Banner tone="danger" title="It wasn't sent">{error}</Banner> : null}
          </div>

          <SheetFooter className="flex-row justify-end">
            <Button type="button" variant="outline" className="max-md:h-11" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" className="max-md:h-11" disabled={pending}>
              {kind === "document" ? "Send request" : "Send question"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
