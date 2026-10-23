import { PracticeUpdateInput } from "@app/schema";
import { CalendarPlus, KeyRound, Smartphone } from "lucide-react";
import * as React from "react";

import { formatDateTime } from "../format";
import { Banner } from "./banner";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { Field, useFieldValidation, type Validate } from "./field";
import { PasskeyList, RecoveryCodes, type PasskeyItem } from "./mfa-cards";
import { Skeleton } from "./skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

// The preparer's Settings (admin 31/32/33-settings, ticket 05b): the page's tabs, the practice's details, and how the
// preparer signs in. Services & pricing is pricing-settings, the engagement letter is letter-template. Presentational:
// values in through props, changes out through callbacks. The admin fetches, saves, toasts and owns the URL.

// ---------- The page ----------

export type SettingsTab = { id: string; label: React.ReactNode; content: React.ReactNode };

/** The Settings page: one tab per section, in the order given. Which tab shows is the caller's (the admin keeps it in the URL). */
export function AdminSettingsPage({
  tabs,
  value,
  onValueChange,
  label = "Settings",
}: {
  tabs: SettingsTab[];
  /** The `id` of the tab showing. */
  value: string;
  onValueChange: (id: string) => void;
  /** The tab list's accessible name. */
  label?: string;
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="animate-page gap-6">
      <TabsList aria-label={label}>
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="max-md:min-h-11">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

// ---------- Practice ----------

/** The practice's details as stored. */
export type PracticeDetails = {
  practiceName: string;
  preparerName: string;
  preparerCredential: string | null;
  replyToEmail: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  /** When they were last saved. */
  updatedAt: string;
};
/** What Save sends: every field, blank where it's optional and empty. */
export type PracticeValues = Record<"practiceName" | "preparerName" | "preparerCredential" | "replyToEmail" | "phone" | "city" | "state", string>;

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

/**
 * The practice's details form. Each field checks itself on blur, then live, then everything on Save (principles.md
 * rule 10); `onSave` is called only when they all pass. Give it a `key` of `updatedAt` so a save resets it.
 */
export function PracticeForm({
  practice: p,
  pending = false,
  error,
  onSave,
  onClearError,
}: {
  practice: PracticeDetails;
  /** True while a save is in flight. */
  pending?: boolean;
  /** Why the last save failed. */
  error?: string | null;
  onSave: (values: PracticeValues) => void;
  /** Clear `error`: called as the form is submitted again. */
  onClearError?: () => void;
}) {
  const f = {
    practiceName: useFieldValidation(V.practiceName, p.practiceName),
    preparerName: useFieldValidation(V.preparerName, p.preparerName),
    preparerCredential: useFieldValidation(V.preparerCredential, p.preparerCredential ?? ""),
    replyToEmail: useFieldValidation(V.replyToEmail, p.replyToEmail),
    phone: useFieldValidation(V.phone, p.phone ?? ""),
    city: useFieldValidation(V.city, p.city ?? ""),
    state: useFieldValidation(V.state, p.state ?? ""),
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onClearError?.();
    const ok = Object.values(f).map((x) => x.validateNow()).every(Boolean);
    if (!ok) return;
    onSave({
      practiceName: f.practiceName.value,
      preparerName: f.preparerName.value,
      preparerCredential: f.preparerCredential.value,
      replyToEmail: f.replyToEmail.value,
      phone: f.phone.value,
      city: f.city.value,
      state: f.state.value,
    });
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
        <Button type="submit" disabled={pending} className="max-md:h-11">
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <span className="text-xs text-muted-foreground">Last saved {formatDateTime(p.updatedAt)}</span>
      </div>
    </form>
  );
}

/**
 * Settings › Practice: the details clients see in the portal, emails and letters, then the way into next season.
 * Skeletons until `practice` arrives; `loadError` instead when it couldn't be read.
 */
export function PracticeSettings({
  practice,
  loadError,
  pending,
  error,
  onSave,
  onClearError,
  renderSeasonLink,
}: {
  /** Undefined while loading. */
  practice?: PracticeDetails;
  /** Why the details couldn't be loaded. */
  loadError?: string | null;
  pending?: boolean;
  error?: string | null;
  onSave: (values: PracticeValues) => void;
  onClearError?: () => void;
  /** The link to the season rollover, wrapped around its label and icon (the app's router link). Leave out to hide the card. */
  renderSeasonLink?: (children: React.ReactNode) => React.ReactElement;
}) {
  return (
    <div className="grid max-w-4xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Practice</CardTitle>
          <CardDescription>Shown to clients in the portal, emails and letters.</CardDescription>
        </CardHeader>
        <CardContent>
          {practice ? (
            <PracticeForm key={practice.updatedAt} practice={practice} pending={pending} error={error} onSave={onSave} onClearError={onClearError} />
          ) : loadError ? (
            <Banner tone="danger" title="Couldn't load the practice details">{loadError}</Banner>
          ) : (
            <div className="grid gap-4 md:grid-cols-3" aria-busy="true" aria-label="Loading practice details">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          )}
        </CardContent>
      </Card>

      {renderSeasonLink ? (
        <Card>
          <CardHeader>
            <CardTitle>Next season</CardTitle>
            <CardDescription>Roll every completed return into the next tax year, with the same people and still-open sources.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              {renderSeasonLink(
                <>
                  <CalendarPlus aria-hidden="true" />
                  Start next season
                </>,
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ---------- Sign-in ----------

export type PreparerSignInMethods = { passkeys: PasskeyItem[]; authenticatorApp: boolean; recoveryCodesLeft: number | null };

/**
 * Settings › Sign-in (ticket 05b): the preparer's passkeys, authenticator app and recovery codes. A new set of codes is
 * shown once, in a dialog that only Done closes, and the old set stops working.
 */
export function PreparerSignIn({
  methods: m,
  canAddPasskey = true,
  onAddPasskey,
  onRemovePasskey,
  onMakeCodes,
  makingCodes = false,
  codesError,
  codes,
  onCodesDone,
  totalCodes = 10,
  appSetupHint = "To set it up, use “Lost your passkey?” on the sign-in page, or run bun run preparer:invite.",
}: {
  /** Undefined while loading (a skeleton stands in). */
  methods?: PreparerSignInMethods;
  /** False where this browser or address can't make passkeys. */
  canAddPasskey?: boolean;
  onAddPasskey: () => Promise<void>;
  onRemovePasskey: (passkeyId: string) => Promise<void>;
  /** Make a new set of recovery codes. */
  onMakeCodes: () => void | Promise<void>;
  /** True while new codes are being made. */
  makingCodes?: boolean;
  /** Why the last new set wasn't made. */
  codesError?: string | null;
  /** A new set to show once; null or undefined when there's none to show. */
  codes?: string[] | null;
  onCodesDone: () => void;
  /** How many codes a set has. */
  totalCodes?: number;
  /** How to set up the authenticator app, shown while it's off. */
  appSetupHint?: React.ReactNode;
}) {
  if (!m) return <Skeleton className="h-72 rounded-xl" />;
  const left = m.recoveryCodesLeft ?? 0;

  return (
    <div className="grid max-w-2xl grid-cols-1 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Passkeys</h2>
          </CardTitle>
          <CardDescription>Sign in with Face ID, Touch ID or your device's PIN. Keep at least one; two is safer.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasskeyList passkeys={m.passkeys} canAdd={canAddPasskey} onAdd={onAddPasskey} onRemove={onRemovePasskey} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Password and authenticator app</h2>
          </CardTitle>
          <CardDescription>The way in when a passkey isn't to hand: your password, then the app's 6-digit code.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p className="flex items-center gap-2">
            <Smartphone aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            Authenticator app: {m.authenticatorApp ? "on" : "not set up"}
          </p>
          {!m.authenticatorApp ? <p className="text-muted-foreground">{appSetupHint}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Recovery codes</h2>
          </CardTitle>
          <CardDescription>Each one signs you in once, in place of the app's code, if you lose your phone.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="flex items-center gap-2 text-sm">
            <KeyRound aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            {left} of {totalCodes} left
          </p>
          {left <= 3 ? <Banner tone="warning" title={left ? "You're running low." : "You have no recovery codes."}>Make a new set and keep it somewhere safe.</Banner> : null}
          {codesError ? <Banner tone="danger" title={codesError} /> : null}
          <Button variant="outline" className="h-11 justify-self-start" disabled={makingCodes} onClick={onMakeCodes}>
            {makingCodes ? "Making new codes…" : "Make new codes"}
          </Button>
          <p className="text-xs text-muted-foreground">Your old codes stop working as soon as new ones are made.</p>
        </CardContent>
      </Card>

      <Dialog open={!!codes} onOpenChange={() => undefined}>
        <DialogContent className="sm:max-w-md" showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogTitle className="sr-only">New recovery codes</DialogTitle>
          {codes ? <RecoveryCodes codes={codes} doneLabel="Done" onDone={onCodesDone} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
