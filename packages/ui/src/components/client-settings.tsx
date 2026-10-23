import { MyContactInput, type ReminderKind, type ReminderPref } from "@app/schema";
import { CircleAlert, Smartphone } from "lucide-react";
import * as React from "react";

import { formatDate } from "../format";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Field, useFieldValidation } from "./field";
import { Label } from "./label";
import { PasskeyList, type PasskeyItem } from "./mfa-cards";
import { ModeToggle } from "./mode-toggle";
import { Skeleton } from "./skeleton";
import { Switch } from "./switch";

// The client's Settings page (portal 21-…-settings): contact details, reminders, how they sign in, and the theme.
// Presentational: values in through props, changes out through callbacks. The portal fetches, saves and toasts.

// ---------- The page ----------

/** The Settings page's frame: its heading, then the cards, or skeletons while they load. */
export function SettingsPage({
  title = "Settings",
  description,
  loading = false,
  loadingLabel = "Loading your settings",
  children,
}: {
  title?: string;
  description?: React.ReactNode;
  /** True until the account has loaded: shows three skeleton cards instead of `children`. */
  loading?: boolean;
  loadingLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-1 animate-page gap-6">
      <header className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </header>
      {loading ? (
        <div className="grid gap-6" aria-busy="true" aria-label={loadingLabel}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ---------- Contact ----------

export type ContactValues = { email: string; phone: string };

const check = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }) => (v: string) => {
  const r = schema.safeParse(v);
  return r.success ? null : (r.error?.issues[0]?.message ?? "Check this field.");
};
const checkEmail = check(MyContactInput.shape.email);
const checkPhone = check(MyContactInput.shape.phone);

/**
 * The legal name (read-only), and the email and mobile phone the client owns. Checks both fields like a person
 * (principles.md rule 10) and calls `onSave` only when they pass, with the email trimmed.
 */
export function ContactCard({
  name,
  email: initialEmail,
  phone: initialPhone,
  preparer,
  description,
  pending = false,
  error,
  emailError,
  saved,
  onSave,
  onClearError,
}: {
  /** The legal name, from the client's tax documents. */
  name: string;
  email: string;
  phone?: string | null;
  /** Who changes the legal name, in the default description. */
  preparer?: string;
  description?: React.ReactNode;
  /** True while a save is in flight. */
  pending?: boolean;
  /** Why the last save failed, under the form. */
  error?: string | null;
  /** A problem with the email itself, such as another login already using it; shown under the email field. */
  emailError?: string | null;
  /** The values as saved: the fields take them when this changes (the server may tidy what was typed). */
  saved?: ContactValues;
  onSave: (values: ContactValues) => void;
  /** Clear an error you passed in: "email" when the email is edited, "form" when the form is submitted again. */
  onClearError?: (which: "email" | "form") => void;
}) {
  const email = useFieldValidation(checkEmail, initialEmail);
  const phone = useFieldValidation(checkPhone, initialPhone ?? "");
  const { setValue: setEmail } = email;
  const { setValue: setPhone } = phone;
  React.useEffect(() => {
    if (!saved) return;
    setEmail(saved.email);
    setPhone(saved.phone);
  }, [saved, setEmail, setPhone]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onClearError?.("form");
    const ok = [email.validateNow(), phone.validateNow()].every(Boolean);
    if (ok) onSave({ email: email.value.trim(), phone: phone.value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Contact</h2>
        </CardTitle>
        <CardDescription>{description ?? `Your legal name comes from your tax documents. Ask ${preparer ?? "your preparer"} to change it.`}</CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={submit} className="grid gap-5">
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Name</span>
            <span>{name}</span>
          </div>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            error={email.error ?? emailError}
            {...email.inputProps}
            onChange={(e) => {
              onClearError?.("email");
              email.inputProps.onChange(e);
            }}
          />
          <Field label="Mobile phone" type="tel" autoComplete="tel" inputMode="tel" hint="For text reminders. Leave it blank if you'd rather not." error={phone.error} {...phone.inputProps} />
          {error ? (
            <p role="alert" className="text-sm text-danger-foreground">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="touch" className="w-fit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------- Reminders ----------

/** What each kind of reminder is called. */
export const REMINDER_KINDS: Record<ReminderKind, string> = {
  requests: "Documents and questions",
  letter: "Your engagement letter",
  invoice: "Invoices and payments",
};

/** Email and text, per kind of reminder. Each switch reports the whole new set through `onChange` as it flips. */
export function RemindersCard({
  reminders,
  onChange,
  canText = true,
  noTextNote = "Add a mobile phone above to get reminders by text.",
  pending = false,
  error,
  kinds = REMINDER_KINDS,
  description = "We only send reminders when something is waiting on you.",
}: {
  /** The current choices, one per kind, in the order shown. */
  reminders: ReminderPref[];
  onChange: (next: ReminderPref[]) => void;
  /** False when texts can't be sent (no mobile phone): the text switches are off limits and `noTextNote` says why. */
  canText?: boolean;
  noTextNote?: React.ReactNode;
  /** True while a change is saving: every switch waits. */
  pending?: boolean;
  /** Why the last change didn't save. */
  error?: string | null;
  kinds?: Record<ReminderKind, string>;
  description?: React.ReactNode;
}) {
  const flip = (kind: ReminderKind, channel: "email" | "text", on: boolean) => onChange(reminders.map((p) => (p.kind === kind ? { ...p, [channel]: on } : p)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Reminders</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="divide-y">
          {reminders.map((p) => (
            <li key={p.kind} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3 first:pt-0 last:pb-0">
              <span className="font-medium">{kinds[p.kind]}</span>
              <span className="flex items-center gap-6">
                {(["email", "text"] as const).map((channel) => {
                  const id = `reminder-${p.kind}-${channel}`;
                  return (
                    <span key={channel} className="flex min-h-11 items-center gap-2">
                      <Switch id={id} checked={p[channel]} disabled={pending || (channel === "text" && !canText)} onCheckedChange={(on) => flip(p.kind, channel, on)} />
                      <Label htmlFor={id} className="min-h-11">
                        {channel === "email" ? "Email" : "Text"}
                      </Label>
                    </span>
                  );
                })}
              </span>
            </li>
          ))}
        </ul>
        {!canText ? <p className="text-sm text-muted-foreground">{noTextNote}</p> : null}
        {error ? (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-danger-foreground">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------- Sign-in ----------

export type SignInMethods = { passkeys: PasskeyItem[]; authenticatorApp: boolean };

/** How the client signs in (ticket 05b): their passkeys (add another, remove one) and whether the authenticator app is on. */
export function SignInCard({
  methods,
  demo = false,
  activeSince,
  canAddPasskey = true,
  onAddPasskey,
  onRemovePasskey,
}: {
  /** Undefined while loading (a skeleton stands in). */
  methods?: SignInMethods;
  /** Signed in through the demo picker, not a real sign-in. */
  demo?: boolean;
  /** When the account was activated. */
  activeSince?: string | null;
  /** False where this browser or address can't make passkeys. */
  canAddPasskey?: boolean;
  onAddPasskey: () => Promise<void>;
  onRemovePasskey: (passkeyId: string) => Promise<void>;
}) {
  const m = methods;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Sign-in</h2>
        </CardTitle>
        <CardDescription>
          {m?.passkeys.length
            ? "You sign in with a passkey: Face ID, Touch ID or your device's PIN."
            : m?.authenticatorApp
              ? "You sign in with your password and a code from your authenticator app."
              : demo
                ? "You're using the demo. You can still try adding a passkey here."
                : "Add a passkey to sign in with your face or fingerprint."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {activeSince ? <p className="text-sm">Account active since {formatDate(activeSince)}</p> : null}
        {m ? (
          <>
            <PasskeyList passkeys={m.passkeys} canAdd={canAddPasskey} onAdd={onAddPasskey} onRemove={onRemovePasskey} />
            {m.authenticatorApp ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone aria-hidden="true" className="size-4 shrink-0" />
                Authenticator app: on, with your password
              </p>
            ) : null}
          </>
        ) : (
          <Skeleton className="h-24 rounded-xl" />
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Appearance ----------

/** Light, dark, or the device's choice. */
export function AppearanceCard({ title = "Appearance", description = "Light, dark, or follow your device." }: { title?: React.ReactNode; description?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ModeToggle variant="menu" className="size-11" />
      </CardContent>
    </Card>
  );
}
