import * as React from "react";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Field, useFieldValidation } from "@app/ui/components/field";
import { Label } from "@app/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@app/ui/components/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@app/ui/components/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@app/ui/components/sheet";
import { Textarea } from "@app/ui/components/textarea";

import { trpc } from "@/lib/trpc";

import { errorText, type Detail } from "./shared";

// Asking the client for something (admin 22-dialogs-and-sheets-sheet-request): a document of a known kind, from
// one person or the whole household, or a plain question. It lands on the client's Documents list.

const HOUSEHOLD = "household";
const CATEGORY: Record<string, string> = {
  income: "Income",
  deduction: "Deductions",
  credit: "Credits",
  identity: "Identity",
  prior_year: "Prior year",
  property: "Property",
  business: "Business",
  other: "Other",
};

export function RequestSheet({ d, name, open, onOpenChange }: { d: Detail; name: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [kind, setKind] = React.useState<"document" | "question">("document");
  const [docKind, setDocKind] = React.useState("");
  const [docKindError, setDocKindError] = React.useState<string | null>(null);
  const [who, setWho] = React.useState(HOUSEHOLD);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const question = useFieldValidation(React.useCallback((v: string) => (v.trim() ? null : "Write the question the client should answer."), []));
  const kinds = trpc.request.documentKinds.useQuery(undefined, { enabled: open, staleTime: 5 * 60_000 });
  const utils = trpc.useUtils();
  const create = trpc.request.create.useMutation();

  React.useEffect(() => {
    if (!open) return;
    setKind("document");
    setDocKind("");
    setDocKindError(null);
    setWho(HOUSEHOLD);
    setNote("");
    setError(null);
    question.setValue("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const groups = React.useMemo(() => {
    const by = new Map<string, { code: string; label: string }[]>();
    for (const k of kinds.data ?? []) by.set(k.category, [...(by.get(k.category) ?? []), k]);
    return [...by.entries()];
  }, [kinds.data]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const personId = who === HOUSEHOLD ? undefined : who;
    const trimmedNote = note.trim() || undefined;
    if (kind === "document" && !docKind) return setDocKindError("Choose the document to ask for.");
    if (kind === "question" && !question.validateNow()) return;
    try {
      await create.mutateAsync(
        kind === "document"
          ? { engagementId: d.engagementId, kind, documentKind: docKind, personId, note: trimmedNote }
          : { engagementId: d.engagementId, kind, title: question.value.trim(), personId, note: trimmedNote },
      );
      await utils.invalidate();
      toast.success(kind === "document" ? "Request sent. The client sees it on their Documents list." : "Question sent to the client.");
      onOpenChange(false);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
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
                    <SelectValue placeholder={kinds.isLoading ? "Loading…" : "Choose a document"} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(([cat, items]) => (
                      <SelectGroup key={cat}>
                        <SelectLabel>{CATEGORY[cat] ?? cat}</SelectLabel>
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
                  {d.people.map((p) => (
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
            <Button type="button" variant="outline" className="max-md:h-11" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" className="max-md:h-11" disabled={create.isPending}>
              {kind === "document" ? "Send request" : "Send question"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
