import type { LetterView } from "@app/schema";
import { Ban, Check, CheckCircle2, CircleAlert, Clock, FileClock, PenLine } from "lucide-react";
import * as React from "react";

import { formatDate } from "../format";
import { cn } from "../utils";
import { Banner } from "./banner";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { EmptyState } from "./empty-state";
import { Field, useFieldValidation } from "./field";
import { PageHeader } from "./page-header";
import { Skeleton } from "./skeleton";
import { StatusChip } from "./status-chip";

// The client portal's engagement letter (portal 14-letter, 15-letter-errors, 16-letter-signed), the one the portal
// renders and Storybook shows: read it, type your name, agree, sign; once signed, the confirmation and who else still
// has to. Data in (a LetterView), signing out through `onSign`; the app owns the mutation and its toasts.

type Signer = LetterView["signers"][number];

const signedChip = (s: Pick<Signer, "signedAt">) =>
  s.signedAt ? <StatusChip tone="success" icon={CheckCircle2} label="Signed" /> : <StatusChip tone="neutral" icon={Clock} label="Not signed yet" />;

// ---------- The letter's text ----------

/**
 * The letter's text as the server stored it (and as it was hashed): the first paragraph is its title, a paragraph
 * starting "1. " is a numbered section with its heading on the first line. Line breaks are kept.
 */
export function LetterBody({ body, className }: { body: string; className?: string }) {
  const [title, ...paragraphs] = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <article aria-label="Engagement letter" className={cn("grid max-w-[65ch] gap-4 text-base leading-relaxed text-pretty", className)}>
      {title ? <h2 className="text-lg font-semibold whitespace-pre-line">{title}</h2> : null}
      {paragraphs.map((p, i) => {
        const [first, ...rest] = p.split("\n");
        return /^\d+\.\s/.test(first!) ? (
          <section key={i} className="grid gap-1">
            <h3 className="font-semibold">{first}</h3>
            {rest.length ? <p className="whitespace-pre-line">{rest.join("\n")}</p> : null}
          </section>
        ) : (
          <p key={i} className={cn("whitespace-pre-line", i === 0 && "text-muted-foreground")}>
            {p}
          </p>
        );
      })}
    </article>
  );
}

// ---------- Signing ----------

const validateName = (v: string) => (v.trim().length >= 2 ? null : "Type your full legal name to sign.");
const CONSENT_ERROR = "Check the box to agree to the letter and to signing electronically.";

/**
 * Typed name + consent (portal 14). Signing too early shows both errors and focuses the first (portal 15). Valid:
 * `onSign` gets the trimmed name. `onSubmitStart` runs on every attempt first, so the app can clear an old `error`.
 * Key it by the letter's hash so a changed letter starts a fresh form.
 */
export function SignLetterForm({
  consentText,
  onSign,
  onSubmitStart,
  pending = false,
  error,
}: {
  /** The consent line the client agrees to, as the server wrote it. */
  consentText: string;
  onSign: (typedName: string) => void;
  onSubmitStart?: () => void;
  pending?: boolean;
  /** Why the server refused, shown above the button. */
  error?: string | null;
}) {
  const name = useFieldValidation(validateName);
  const [consent, setConsent] = React.useState(false);
  const [consentError, setConsentError] = React.useState<string | null>(null);
  const id = React.useId();
  const nameId = `${id}-name`;
  const consentId = `${id}-consent`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitStart?.();
    const nameOk = name.validateNow();
    setConsentError(consent ? null : CONSENT_ERROR);
    if (!nameOk) return document.getElementById(nameId)?.focus();
    if (!consent) return document.getElementById(consentId)?.focus();
    onSign(name.value.trim());
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
            {consentText}
          </label>
        </div>
        {consentError ? (
          <p id={`${consentId}-error`} role="alert" className="flex items-start gap-1.5 text-sm text-danger-foreground">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {consentError}
          </p>
        ) : null}
      </div>

      {error ? <Banner tone="danger" title="The letter wasn't signed">{error}</Banner> : null}

      <div className="grid gap-2">
        <Button type="submit" size="touch" className="w-full md:w-fit" disabled={pending}>
          <PenLine /> {pending ? "Signing…" : "Sign the letter"}
        </Button>
        <p className="text-sm text-muted-foreground">Signing here counts the same as signing on paper.</p>
      </div>
    </form>
  );
}

// ---------- Signed ----------

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const first = (name: string) => name.split(/\s+/)[0]!;

/** After signing (portal 16): who signed, when, in the viewer's time zone, and who still has to. */
export function LetterSigned({ letter, me, preparer = "your preparer" }: { letter: Pick<LetterView, "signers">; me: Signer; /** Who starts once everyone has signed. */ preparer?: string }) {
  const others = letter.signers.filter((s) => !s.isMe);
  const waiting = others.filter((s) => !s.signedAt);
  return (
    <div className="grid max-w-xl gap-6">
      <div className="grid gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
          <Check aria-hidden="true" className="size-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Letter signed</h1>
        <p className="text-muted-foreground">
          {waiting.length
            ? `Thanks. The letter is complete once ${waiting.map((s) => first(s.name)).join(" and ")} signs too.`
            : `Thanks. Everyone has signed, so ${preparer} can get started.`}
        </p>
      </div>
      <dl className="divide-y overflow-hidden rounded-xl border bg-card">
        {[
          ["Signed by", me.name],
          ["Date", formatDate(me.signedAt!, { month: "long", day: "numeric", year: "numeric" })],
          ["Time", time(me.signedAt!)],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {others.length ? (
        <ul aria-label="Other signers" className="grid gap-2">
          {others.map((s) => (
            <li key={s.personId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{s.signedAt ? `${s.name} signed on ${formatDate(s.signedAt, { month: "long", day: "numeric" })}` : `Waiting for ${first(s.name)} to sign`}</span>
              {signedChip(s)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Everyone filing signs: each signer and whether they have. Shown only when there's more than one. */
export function LetterSigners({ signers }: { signers: Signer[] }) {
  if (signers.length <= 1) return null;
  return (
    <section aria-label="Who signs" className="grid max-w-xl gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">Everyone filing signs</h2>
      <ul className="grid gap-2">
        {signers.map((s) => (
          <li key={s.personId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{s.isMe ? `${s.name} (you)` : s.name}</span>
            {signedChip(s)}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- The whole screen ----------

/**
 * The Letter screen, every state: no return yet, loading, not sent yet, withdrawn, signed (with the letter to read
 * again) and ready to sign. `renderSignForm` draws the sign form the app wires to its mutation (a `SignLetterForm`).
 */
export function LetterScreen({
  noReturn = false,
  loading = false,
  letter,
  preparer,
  renderSignForm,
}: {
  /** The client has no return yet. */
  noReturn?: boolean;
  loading?: boolean;
  /** The letter for this return; null or a draft while there's none to show. */
  letter?: LetterView | null;
  /** The preparer's first name, or a stand-in like "Your preparer" (it starts sentences). */
  preparer: string;
  renderSignForm: (letter: LetterView) => React.ReactNode;
}) {
  if (noReturn) return <EmptyState icon={FileClock} title="No return yet" description="Your engagement letter shows up here once your return is opened." />;
  if (loading) return <Skeleton aria-label="Loading your letter" className="h-96 rounded-xl" />;

  if (!letter || letter.status === "draft") {
    return <EmptyState icon={FileClock} title="Your letter isn't ready yet" description={`${preparer} will send your engagement letter here. Nothing to do until then.`} />;
  }
  if (letter.status === "void") {
    return <EmptyState icon={Ban} title="This letter was withdrawn" description={`${preparer} will send you a new one to sign. Nothing to do until then.`} />;
  }

  const me = letter.signers.find((s) => s.isMe);
  if (me?.signedAt) {
    return (
      <div className="grid grid-cols-1 content-start gap-8">
        <LetterSigned letter={letter} me={me} />
        <details className="group max-w-[70ch] rounded-xl border bg-card">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">Read the letter again</summary>
          <LetterBody body={letter.body} className="px-4 pb-6" />
        </details>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 content-start gap-6">
      <PageHeader title="Engagement letter" description={`This explains what ${preparer} will do for you and what it costs. Read it, then sign below.`} />

      <div tabIndex={0} aria-label="Letter text, scrollable" className="max-h-[60svh] max-w-[70ch] overflow-y-auto rounded-xl border bg-card px-5 py-6 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none md:px-8">
        <LetterBody body={letter.body} />
      </div>

      <LetterSigners signers={letter.signers} />

      {letter.canSign ? (
        renderSignForm(letter)
      ) : (
        <EmptyState
          icon={PenLine}
          title={letter.status === "signed" ? "Everyone has signed" : "Signed by the people filing"}
          description={letter.status === "signed" ? "Nothing more to do here." : "Only the people filing these returns sign this letter. You can read it here."}
          className="max-w-xl"
        />
      )}
    </div>
  );
}
