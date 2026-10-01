import type { LetterView } from "@app/schema";
import { CircleAlert, PenLine } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Checkbox } from "@app/ui/components/checkbox";
import { Field, useFieldValidation } from "@app/ui/components/field";

import { trpc } from "@/lib/trpc";

// Typed name + consent, then letter.sign (portal 14). Signing too early shows both errors and focuses the
// first (portal 15). The hash sent is the one for the text on screen; if the letter changed, the server says so.

const validateName = (v: string) => (v.trim().length >= 2 ? null : "Type your full legal name to sign.");
const CONSENT_ERROR = "Check the box to agree to the letter and to signing electronically.";

export function SignForm({ letter }: { letter: LetterView }) {
  const utils = trpc.useUtils();
  const name = useFieldValidation(validateName);
  const [consent, setConsent] = React.useState(false);
  const [consentError, setConsentError] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const id = React.useId();
  const nameId = `${id}-name`;
  const consentId = `${id}-consent`;

  const sign = trpc.letter.sign.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.letter.get.invalidate(), utils.engagement.mine.invalidate()]);
      toast.success("Letter signed", { description: "Thank you. Your preparer can see it now." });
    },
    onError: (e) => {
      setServerError(e.message);
      if (e.data?.code === "CONFLICT") void utils.letter.get.invalidate();
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const nameOk = name.validateNow();
    setConsentError(consent ? null : CONSENT_ERROR);
    if (!nameOk) return document.getElementById(nameId)?.focus();
    if (!consent) return document.getElementById(consentId)?.focus();
    sign.mutate({ letterId: letter.id, typedName: name.value.trim(), consent: true, bodySha256: letter.bodySha256 });
  };

  return (
    <form onSubmit={submit} noValidate className="grid max-w-xl gap-5">
      <Field id={nameId} label="Type your full legal name" autoComplete="name" autoCapitalize="words" spellCheck={false} error={name.error} {...name.inputProps} />

      <div className="grid gap-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id={consentId}
            className="mt-1"
            checked={consent}
            aria-invalid={consentError ? true : undefined}
            aria-describedby={consentError ? `${consentId}-error` : undefined}
            onCheckedChange={(v) => {
              setConsent(v === true);
              if (v === true) setConsentError(null);
            }}
          />
          <label htmlFor={consentId} className="text-base leading-snug md:text-sm">
            {letter.consentText}
          </label>
        </div>
        {consentError ? (
          <p id={`${consentId}-error`} role="alert" className="flex items-start gap-1.5 text-sm text-danger-foreground">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {consentError}
          </p>
        ) : null}
      </div>

      {serverError ? <Banner tone="danger" title="The letter wasn't signed">{serverError}</Banner> : null}

      <div className="grid gap-2">
        <Button type="submit" size="touch" className="w-full md:w-fit" disabled={sign.isPending}>
          <PenLine /> {sign.isPending ? "Signing…" : "Sign the letter"}
        </Button>
        <p className="text-sm text-muted-foreground">Signing here counts the same as signing on paper.</p>
      </div>
    </form>
  );
}
