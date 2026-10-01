import { Check, CircleAlert, CircleDashed, Eye, EyeOff, ShieldCheck } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "./alert-dialog";
import { Banner } from "./banner";
import { Button } from "./button";
import { Input } from "./input";
import { ShieldMark } from "./logo";

// The portal's way in (portal 01-access-invite, 02-access-setpw, 04-access-expired). Presentational: props in,
// callbacks out. The routes and sessions arrive with real sign-in (ticket 05).

const first = (name: string) => name.split(/\s+/)[0] ?? name;

// 01: the invite link's landing page. One action: set up the account.
export function InviteWelcome({
  preparerName,
  practiceName,
  email,
  expiresInDays = 7,
  onAccept,
  onSignIn,
  className,
}: {
  preparerName: string;
  practiceName: string;
  email: string;
  expiresInDays?: number;
  onAccept: () => void;
  onSignIn?: () => void;
  className?: string;
}) {
  return (
    <section data-slot="invite-welcome" aria-labelledby="invite-title" className={cn("grid w-full max-w-sm gap-6", className)}>
      <ShieldMark className="h-12 justify-self-start" />
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">Invitation from {practiceName}</p>
        <h1 id="invite-title" className="text-3xl font-semibold tracking-tight text-balance">
          {preparerName} invited you to set up your account
        </h1>
        <p className="text-pretty text-muted-foreground">
          This is where you'll answer a few questions, upload your tax documents, and see where your return stands.
        </p>
      </div>
      <div className="grid gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Your account email</p>
          <p className="font-medium break-all">{email}</p>
        </div>
        <Button size="touch" onClick={onAccept}>
          Set up my account
        </Button>
      </div>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Your documents are encrypted and only {first(preparerName)} can see them. This invite link works once and expires in {expiresInDays}{" "}
        {expiresInDays === 1 ? "day" : "days"}.
      </p>
      {onSignIn ? (
        <p className="text-sm text-muted-foreground">
          Already set up?{" "}
          <Button variant="link" className="h-11 px-1 text-sm" onClick={onSignIn}>
            Sign in
          </Button>
        </p>
      ) : null}
    </section>
  );
}

// 02: create a password. The checklist updates as you type; errors follow principles.md rule 10 (on leaving a
// field, live once shown, everything again on submit). If `onSubmit` throws, its message shows above the button.

export const PASSWORD_MIN = 12;

export function passwordRules(password: string, again: string, email: string) {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const lower = password.toLowerCase();
  const usesEmail = !!password && (lower.includes(email.toLowerCase()) || (local.length >= 3 && lower.includes(local)));
  return [
    { key: "length", label: `At least ${PASSWORD_MIN} characters`, ok: password.length >= PASSWORD_MIN },
    { key: "email", label: "Not your email address", ok: !!password && !usesEmail },
    { key: "match", label: "Both passwords match", ok: !!password && password === again },
  ];
}

function passwordError(password: string, email: string) {
  if (!password) return "Create a password.";
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (!passwordRules(password, "", email)[1]!.ok) return "Don't use your email address in your password.";
  return null;
}
const againError = (password: string, again: string) => (!again ? "Type your password again." : again !== password ? "The passwords don't match." : null);

function PasswordInput({
  id,
  label,
  value,
  error,
  shown,
  onToggle,
  onChange,
  onBlur,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  error: string | null;
  shown: boolean;
  onToggle?: () => void;
  onChange: (v: string) => void;
  onBlur: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          autoComplete="new-password"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn("h-11", onToggle && "pr-12")}
        />
        {onToggle ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            className="absolute top-0 right-0 text-muted-foreground"
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            onClick={onToggle}
          >
            {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-sm text-danger-foreground">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SetPasswordForm({ email, onSubmit, className }: { email: string; onSubmit: (password: string) => void | Promise<void>; className?: string }) {
  const id = React.useId();
  const [pw, setPw] = React.useState("");
  const [again, setAgain] = React.useState("");
  const [shown, setShown] = React.useState(false);
  const [errors, setErrors] = React.useState<{ pw: string | null; again: string | null }>({ pw: null, again: null });
  const [live, setLive] = React.useState({ pw: false, again: false });
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);
  const rules = passwordRules(pw, again, email);

  const checkPw = (v: string) => {
    const e = passwordError(v, email);
    setErrors((x) => ({ ...x, pw: e }));
    if (e) setLive((x) => ({ ...x, pw: true }));
    return !e;
  };
  const checkAgain = (v: string, p = pw) => {
    const e = againError(p, v);
    setErrors((x) => ({ ...x, again: e }));
    if (e) setLive((x) => ({ ...x, again: true }));
    return !e;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = [checkPw(pw), checkAgain(again)].every(Boolean);
    if (!ok || pending) return;
    setPending(true);
    setFailed(null);
    try {
      await onSubmit(pw);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section data-slot="set-password-form" aria-labelledby={`${id}-title`} className={cn("grid w-full max-w-sm gap-6", className)}>
      <div className="grid gap-2">
        <h1 id={`${id}-title`} className="text-3xl font-semibold tracking-tight">
          Create a password
        </h1>
        <p className="text-pretty text-muted-foreground">
          You'll use it with <span className="break-all text-foreground">{email}</span> to sign in.
        </p>
      </div>
      <form noValidate className="grid gap-4" onSubmit={submit}>
        <PasswordInput
          id={`${id}-pw`}
          label="Password"
          value={pw}
          error={errors.pw}
          shown={shown}
          onToggle={() => setShown((s) => !s)}
          onChange={(v) => {
            setPw(v);
            if (live.pw) checkPw(v);
            if (live.again) checkAgain(again, v);
          }}
          onBlur={() => checkPw(pw)}
        />
        <PasswordInput
          id={`${id}-again`}
          label="Type it again"
          value={again}
          error={errors.again}
          shown={shown}
          onChange={(v) => {
            setAgain(v);
            if (live.again) checkAgain(v);
          }}
          onBlur={() => checkAgain(again)}
        />
        <ul aria-label="Password rules" className="grid gap-2 text-sm">
          {rules.map((r) => (
            <li key={r.key} data-ok={r.ok} className={cn("flex items-center gap-2", r.ok ? "text-success-foreground" : "text-muted-foreground")}>
              {r.ok ? <Check aria-hidden="true" className="size-4 shrink-0" /> : <CircleDashed aria-hidden="true" className="size-4 shrink-0" />}
              <span className="text-foreground">{r.label}</span>
              <span className="sr-only">{r.ok ? ", done" : ", not yet"}</span>
            </li>
          ))}
        </ul>
        {failed ? <Banner tone="danger" title={failed} /> : null}
        <Button type="submit" size="touch" disabled={pending}>
          {pending ? "Creating your account…" : "Create account"}
        </Button>
      </form>
    </section>
  );
}

// 04: signed out for inactivity. Calm, says nothing was lost, one way forward. No dismiss: the page behind
// can't be used until they sign in again.
export function SessionExpired({ open, minutes = 30, onSignIn }: { open: boolean; minutes?: number; onSignIn: () => void }) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="gap-6 sm:max-w-md">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>You've been signed out</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-pretty">
            For your security, you're signed out after {minutes} minutes without activity. Everything you entered is saved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogAction className="h-11 text-base" onClick={onSignIn}>
          Sign in again
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
}
