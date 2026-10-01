import { MyContactInput } from "@app/schema";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@app/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { Field, useFieldValidation } from "@app/ui/components/field";

import { trpc, type RouterOutputs } from "@/lib/trpc";

// Contact (portal 21-…-settings): the legal name is read-only; email and mobile phone are the client's.

type Me = RouterOutputs["me"]["get"];

const check = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }) => (v: string) => {
  const r = schema.safeParse(v);
  return r.success ? null : (r.error?.issues[0]?.message ?? "Check this field.");
};
const checkEmail = check(MyContactInput.shape.email);
const checkPhone = check(MyContactInput.shape.phone);

export function ContactCard({ me, preparer }: { me: Me; preparer: string }) {
  const utils = trpc.useUtils();
  const email = useFieldValidation(checkEmail, me.email);
  const phone = useFieldValidation(checkPhone, me.phone ?? "");
  const [taken, setTaken] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);

  const save = trpc.me.updateContact.useMutation({
    onSuccess: (next) => {
      utils.me.get.setData(undefined, next);
      email.setValue(next.email);
      phone.setValue(next.phone ?? "");
      toast.success("Saved");
    },
    onError: (e) => {
      if (e.data?.code === "CONFLICT") setTaken(e.message);
      else setFailed(e.message);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFailed(null);
    const ok = [email.validateNow(), phone.validateNow()].every(Boolean);
    if (ok) save.mutate({ email: email.value.trim(), phone: phone.value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Contact</h2>
        </CardTitle>
        <CardDescription>Your legal name comes from your tax documents. Ask {preparer} to change it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={submit} className="grid gap-5">
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Name</span>
            <span>{me.name}</span>
          </div>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            error={email.error ?? taken}
            {...email.inputProps}
            onChange={(e) => {
              setTaken(null);
              email.inputProps.onChange(e);
            }}
          />
          <Field label="Mobile phone" type="tel" autoComplete="tel" inputMode="tel" hint="For text reminders. Leave it blank if you'd rather not." error={phone.error} {...phone.inputProps} />
          {failed ? (
            <p role="alert" className="text-sm text-danger-foreground">
              {failed}
            </p>
          ) : null}
          <Button type="submit" size="touch" className="w-fit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
