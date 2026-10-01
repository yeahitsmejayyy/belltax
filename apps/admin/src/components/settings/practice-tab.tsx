import { PracticeUpdateInput } from "@app/schema";
import { CalendarPlus } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { Field, useFieldValidation, type Validate } from "@app/ui/components/field";
import { Skeleton } from "@app/ui/components/skeleton";
import { formatDateTime } from "@app/ui/format";

import { trpc, type RouterOutputs } from "@/lib/trpc";

import { serverMessage } from "./server-error";

// Settings › Practice (admin 31-settings-settings-practice): the details clients see in the portal, emails and
// letters. Each field checks itself on blur, then live, then everything on Save (principles.md rule 10).

type Practice = RouterOutputs["settings"]["practice"]["get"];
const S = PracticeUpdateInput.shape;

const check =
  (schema: { safeParse: (v: string) => { success: boolean; error?: { issues: { message: string }[] } } }, fallback: string): Validate =>
  (v) => {
    const r = schema.safeParse(v);
    return r.success ? null : (r.error?.issues[0]?.message ?? fallback);
  };

const V = {
  practiceName: check(S.practiceName, "Enter the practice name."),
  preparerName: check(S.preparerName, "Enter the preparer's name."),
  preparerCredential: check(S.preparerCredential, "Keep it under 80 characters."),
  replyToEmail: check(S.replyToEmail, "Enter a valid email, like m@example.com."),
  phone: check(S.phone, "Enter a 10-digit US number, or leave it blank."),
  city: check(S.city, "Keep it under 60 characters."),
  state: check(S.state, "Use the two-letter state, like CA."),
};

function PracticeForm({ p }: { p: Practice }) {
  const utils = trpc.useUtils();
  const save = trpc.settings.practice.update.useMutation();
  const [error, setError] = React.useState<string | null>(null);

  const f = {
    practiceName: useFieldValidation(V.practiceName, p.practiceName),
    preparerName: useFieldValidation(V.preparerName, p.preparerName),
    preparerCredential: useFieldValidation(V.preparerCredential, p.preparerCredential ?? ""),
    replyToEmail: useFieldValidation(V.replyToEmail, p.replyToEmail),
    phone: useFieldValidation(V.phone, p.phone ?? ""),
    city: useFieldValidation(V.city, p.city ?? ""),
    state: useFieldValidation(V.state, p.state ?? ""),
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const ok = Object.values(f).map((x) => x.validateNow()).every(Boolean);
    if (!ok) return;
    try {
      await save.mutateAsync({
        practiceName: f.practiceName.value,
        preparerName: f.preparerName.value,
        preparerCredential: f.preparerCredential.value,
        replyToEmail: f.replyToEmail.value,
        phone: f.phone.value,
        city: f.city.value,
        state: f.state.value,
      });
      await utils.invalidate();
      toast.success("Practice details saved");
    } catch (err) {
      setError(serverMessage(err));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Practice name" autoComplete="organization" error={f.practiceName.error} {...f.practiceName.inputProps} />
        <Field label="Preparer" autoComplete="name" error={f.preparerName.error} {...f.preparerName.inputProps} />
        <Field label="Credential" hint="Optional, like EA or CPA." error={f.preparerCredential.error} {...f.preparerCredential.inputProps} />
        <Field label="Reply-to email" type="email" autoComplete="email" error={f.replyToEmail.error} {...f.replyToEmail.inputProps} />
        <Field label="Phone for client texts" type="tel" autoComplete="tel" hint="Optional. Never shown publicly." error={f.phone.error} {...f.phone.inputProps} />
        <div className="grid grid-cols-[1fr_6rem] gap-4">
          <Field label="City" autoComplete="address-level2" error={f.city.error} {...f.city.inputProps} />
          <Field label="State" autoComplete="address-level1" maxLength={2} error={f.state.error} {...f.state.inputProps} />
        </div>
      </div>
      {error ? <Banner tone="danger" title="Not saved">{error}</Banner> : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={save.isPending} className="max-md:h-11">
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
        <span className="text-xs text-muted-foreground">Last saved {formatDateTime(p.updatedAt)}</span>
      </div>
    </form>
  );
}

export function PracticeTab() {
  const q = trpc.settings.practice.get.useQuery();
  return (
    <div className="grid max-w-4xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Practice</CardTitle>
          <CardDescription>Shown to clients in the portal, emails and letters.</CardDescription>
        </CardHeader>
        <CardContent>
          {q.data ? (
            <PracticeForm key={q.data.updatedAt} p={q.data} />
          ) : q.error ? (
            <Banner tone="danger" title="Couldn't load the practice details">{q.error.message}</Banner>
          ) : (
            <div className="grid gap-4 md:grid-cols-3" aria-busy="true" aria-label="Loading practice details">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next season</CardTitle>
          <CardDescription>Roll every completed return into the next tax year, with the same people and still-open sources.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/season">
              <CalendarPlus aria-hidden="true" />
              Start next season
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
