import { Check, Copy, Download, Fingerprint, KeyRound, Mail, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import * as React from "react";
import { encode } from "uqr";

import { formatDate } from "../format";
import { cn } from "../utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./alert-dialog";
import { Badge } from "./badge";
import { Banner } from "./banner";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { BellMark } from "./logo";

// MFA for everyone (ticket 05b): set up a passkey, the authenticator-app fallback, the code at sign-in, the preparer's
// recovery codes, "Lost your passkey?", and the passkeys in Settings. Presentational: props in, callbacks out. A
// callback that throws shows its message; the apps turn the browser's own errors into words first.

const errorText = (err: unknown) => (err instanceof Error ? err.message : "That didn't work. Try again.");

// Run an async action with a pending flag and an error message, the way every card here does.
function useAction() {
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);
  const run = async (fn: () => void | Promise<void>) => {
    if (pending) return;
    setPending(true);
    setFailed(null);
    try {
      await fn();
    } catch (err) {
      setFailed(errorText(err));
    } finally {
      setPending(false);
    }
  };
  return { pending, failed, setFailed, run };
}

function Heading({ id, icon, title, children }: { id: string; icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      {icon ?? <BellMark className="mb-4 size-12 justify-self-start" />}
      <h1 id={id} className="text-3xl font-semibold tracking-tight text-balance">
        {title}
      </h1>
      {children ? <div className="grid gap-2 text-pretty text-muted-foreground">{children}</div> : null}
    </div>
  );
}

const IconTile = ({ children }: { children: React.ReactNode }) => (
  <span aria-hidden="true" className="mb-4 grid size-12 place-items-center rounded-xl bg-primary/15 text-foreground [&_svg]:size-6">
    {children}
  </span>
);

// ---------- Set up a passkey ----------

/** The one setup step a client sees (and the preparer's first): make a passkey on this device. */
export function PasskeySetup({
  purpose = "invite",
  available,
  onCreate,
  onFallback,
  step,
  className,
}: {
  purpose?: "invite" | "reset";
  /** False where this browser or address can't make passkeys. */
  available: boolean;
  onCreate: () => Promise<void>;
  /** The authenticator-app route, for a device that can't do passkeys. Clients only. */
  onFallback?: () => void;
  /** "Step 1 of 3", for the preparer's longer setup. */
  step?: string;
  className?: string;
}) {
  const id = React.useId();
  const a = useAction();
  return (
    <section data-slot="passkey-setup" aria-labelledby={id} className={cn("grid w-full max-w-sm gap-6", className)}>
      <Heading id={id} icon={<IconTile><Fingerprint /></IconTile>} title={purpose === "reset" ? "Set up a new passkey" : "Sign in with your face or fingerprint"}>
        {step ? <p className="text-sm font-medium text-foreground">{step}</p> : null}
        <p>A passkey signs you in with Face ID, Touch ID or your device's PIN. There's no password to remember, and it only works on this site, so it can't be phished.</p>
      </Heading>
      {purpose === "reset" ? <Banner tone="info" title="Your old passkeys stop working once this is done, and you'll be signed out everywhere else." /> : null}
      {available ? (
        <div className="grid gap-3">
          {a.failed ? <Banner tone="danger" title={a.failed} /> : null}
          <Button size="touch" disabled={a.pending} aria-busy={a.pending} onClick={() => a.run(onCreate)}>
            <Fingerprint aria-hidden="true" />
            {a.pending ? "Waiting for your device…" : "Set up a passkey"}
          </Button>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            It's saved to your iCloud Keychain or Google account, so your other devices can sign in with it too.
          </p>
        </div>
      ) : (
        <Banner tone="warning" title="This browser can't make a passkey here.">
          {onFallback ? "Use a password and an authenticator app instead, or open this link on your phone." : "Open this page at localhost (not 127.0.0.1) in Safari, Chrome or Edge."}
        </Banner>
      )}
      {onFallback ? (
        <Button variant={available ? "link" : "default"} size={available ? "default" : "touch"} className={cn(available && "h-11 justify-self-start px-0")} onClick={onFallback}>
          {available ? "My device can't do this" : "Use a password and an authenticator app"}
        </Button>
      ) : null}
    </section>
  );
}

// ---------- The authenticator app ----------

/** A QR code drawn from the otpauth:// address. Dark modules on white in either theme: scanners need the contrast. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const qr = React.useMemo(() => encode(value, { ecc: "M", border: 2 }), [value]);
  const path = qr.data.flatMap((row, y) => row.flatMap((on, x) => (on ? [`M${x} ${y}h1v1h-1z`] : []))).join("");
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" className={cn("size-44 rounded-lg bg-white p-1", className)}>
      <path d={path} fill="#1c1c1c" />
    </svg>
  );
}

function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/** A one-time code field: six digits from an app, or (when `recovery`) a recovery code. */
function CodeField({ id, label, value, onChange, recovery = false, autoFocus }: { id: string; label: string; value: string; onChange: (v: string) => void; recovery?: boolean; autoFocus?: boolean }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        autoFocus={autoFocus}
        autoComplete="one-time-code"
        inputMode={recovery ? "text" : "numeric"}
        autoCapitalize="none"
        spellCheck={false}
        maxLength={recovery ? 12 : 7}
        placeholder={recovery ? "xxxxx-xxxxx" : "123456"}
        onChange={(e) => onChange(recovery ? e.target.value : e.target.value.replace(/[^\d ]/g, ""))}
        className="h-11 font-mono text-lg tracking-widest"
      />
    </div>
  );
}

/** Add the practice to an authenticator app, then prove it with the first code. */
export function AuthenticatorSetup({
  secret,
  uri,
  onSubmit,
  step,
  submitLabel = "Finish setting up",
  className,
}: {
  secret: string;
  uri: string;
  onSubmit: (code: string) => Promise<void>;
  step?: string;
  submitLabel?: string;
  className?: string;
}) {
  const id = React.useId();
  const [code, setCode] = React.useState("");
  const a = useAction();
  const grouped = secret.match(/.{1,4}/g)?.join(" ") ?? secret;
  return (
    <section data-slot="authenticator-setup" aria-labelledby={id} className={cn("grid w-full max-w-sm gap-6", className)}>
      <Heading id={id} icon={<IconTile><Smartphone /></IconTile>} title="Add an authenticator app">
        {step ? <p className="text-sm font-medium text-foreground">{step}</p> : null}
        <p>It shows a new 6-digit code every 30 seconds. You'll type one after your password when you sign in.</p>
      </Heading>
      <ol className="grid gap-5 text-sm">
        <li className="grid gap-1">
          <span className="font-medium">1. Open an authenticator app</span>
          <span className="text-muted-foreground">Google Authenticator, Microsoft Authenticator, 1Password or any other.</span>
        </li>
        <li className="grid gap-3">
          <span className="font-medium">2. Scan this code</span>
          <QrCode value={uri} label="QR code for your authenticator app" />
          <span className="text-muted-foreground">
            On this phone?{" "}
            <a href={uri} className="font-medium text-foreground underline underline-offset-4">
              Open it in the app
            </a>
            , or type the key:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-muted px-2 py-1.5 font-mono text-sm break-all">{grouped}</code>
            <CopyButton text={secret} label="Copy key" className="h-9" />
          </div>
        </li>
        <li className="grid gap-3">
          <span className="font-medium">3. Enter the code it shows</span>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.replace(/\s/g, "").length !== 6) return a.setFailed("Enter the 6-digit code from the app.");
              void a.run(() => onSubmit(code.replace(/\s/g, "")));
            }}
          >
            <CodeField id={`${id}-code`} label="6-digit code" value={code} onChange={setCode} />
            {a.failed ? <Banner tone="danger" title={a.failed} /> : null}
            <Button type="submit" size="touch" disabled={a.pending} aria-busy={a.pending}>
              {a.pending ? "Checking…" : submitLabel}
            </Button>
          </form>
        </li>
      </ol>
    </section>
  );
}

// ---------- The code at sign-in ----------

/** After the right password: the app's code, or (the preparer) a recovery code. */
export function CodeStep({
  email,
  recoveryCodes = false,
  onSubmit,
  onBack,
  className,
}: {
  email: string;
  recoveryCodes?: boolean;
  onSubmit: (code: string) => Promise<void>;
  onBack?: () => void;
  className?: string;
}) {
  const id = React.useId();
  const [code, setCode] = React.useState("");
  const [recovery, setRecovery] = React.useState(false);
  const a = useAction();
  return (
    <section data-slot="code-step" aria-labelledby={id} className={cn("grid w-full max-w-sm gap-6", className)}>
      <Heading id={id} icon={<IconTile><Smartphone /></IconTile>} title={recovery ? "Use a recovery code" : "Enter your code"}>
        <p>
          {recovery ? "Each recovery code works once. " : "Open your authenticator app and enter the 6-digit code for "}
          {recovery ? null : <span className="break-all text-foreground">{email}</span>}
          {recovery ? null : "."}
        </p>
      </Heading>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!code.trim()) return a.setFailed(recovery ? "Enter a recovery code." : "Enter the 6-digit code from the app.");
          void a.run(() => onSubmit(code.trim()));
        }}
      >
        <CodeField key={String(recovery)} id={`${id}-code`} label={recovery ? "Recovery code" : "6-digit code"} value={code} onChange={setCode} recovery={recovery} autoFocus />
        {a.failed ? <Banner tone="danger" title={a.failed} /> : null}
        <Button type="submit" size="touch" disabled={a.pending} aria-busy={a.pending}>
          {a.pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="flex flex-wrap gap-x-4">
        {recoveryCodes ? (
          <Button
            variant="link"
            className="h-11 px-0"
            onClick={() => {
              setRecovery((r) => !r);
              setCode("");
              a.setFailed(null);
            }}
          >
            {recovery ? "Use the app's code" : "No phone? Use a recovery code"}
          </Button>
        ) : null}
        {onBack ? (
          <Button variant="link" className="h-11 px-0 text-muted-foreground" onClick={onBack}>
            Back
          </Button>
        ) : null}
      </div>
    </section>
  );
}

// ---------- Recovery codes (the preparer) ----------

/** Shown once, right after setup or after making a new set. Continue waits until they say they've saved them. */
export function RecoveryCodes({ codes, onDone, doneLabel = "Continue", className }: { codes: string[]; onDone: () => void; doneLabel?: string; className?: string }) {
  const id = React.useId();
  const [saved, setSaved] = React.useState(false);
  const text = `Bell Tax recovery codes\nEach works once, in place of the authenticator app's code.\n\n${codes.join("\n")}\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "belltax-recovery-codes.txt" });
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section data-slot="recovery-codes" aria-labelledby={id} className={cn("grid w-full max-w-sm gap-6", className)}>
      <Heading id={id} icon={<IconTile><KeyRound /></IconTile>} title="Save your recovery codes">
        <p>If you lose your phone, each code signs you in once in place of the app's code. They won't be shown again.</p>
      </Heading>
      <ul aria-label="Recovery codes" className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-4 font-mono text-sm">
        {codes.map((c) => (
          <li key={c} className="tracking-wide">
            {c}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <CopyButton text={text} label="Copy all" className="h-11" />
        <Button type="button" variant="outline" className="h-11" onClick={download}>
          <Download aria-hidden="true" />
          Download
        </Button>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} className="mt-0.5" />
        <span>I've saved them somewhere safe, like a password manager, or printed and locked away.</span>
      </label>
      <Button size="touch" disabled={!saved} onClick={onDone}>
        {doneLabel}
      </Button>
    </section>
  );
}

// ---------- Lost your passkey? ----------

/** Self-serve recovery: a one-time link to the address on file. The answer is the same whether or not it's an account. */
export function LostPasskey({ onSubmit, onBack, className }: { onSubmit: (email: string) => Promise<void>; onBack?: () => void; className?: string }) {
  const id = React.useId();
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState<string | null>(null);
  const a = useAction();
  if (sent)
    return (
      <section data-slot="lost-passkey" aria-labelledby={id} className={cn("grid w-full max-w-sm gap-6", className)}>
        <Heading id={id} icon={<IconTile><Mail /></IconTile>} title="Check your email">
          <p>
            If <span className="break-all text-foreground">{sent}</span> has an account, a link is on its way. It works once, for 24 hours.
          </p>
          <p>Using it removes your old passkeys and signs you out everywhere else, so a lost phone can't be used to get in.</p>
        </Heading>
        {onBack ? (
          <Button size="touch" variant="outline" onClick={onBack}>
            Back to sign in
          </Button>
        ) : null}
      </section>
    );
  return (
    <section data-slot="lost-passkey" aria-labelledby={id} className={cn("grid w-full max-w-sm gap-6", className)}>
      <Heading id={id} icon={<IconTile><KeyRound /></IconTile>} title="Lost your passkey?">
        <p>New phone, or a passkey that stopped working? We'll email you a link to set up sign-in again on the device you have now.</p>
      </Heading>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return a.setFailed("Enter your email.");
          void a.run(async () => {
            await onSubmit(email.trim());
            setSent(email.trim());
          });
        }}
      >
        <div className="grid gap-2">
          <label htmlFor={`${id}-email`} className="text-sm font-medium">
            Email
          </label>
          <Input id={`${id}-email`} type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        {a.failed ? <Banner tone="danger" title={a.failed} /> : null}
        <Button type="submit" size="touch" disabled={a.pending} aria-busy={a.pending}>
          {a.pending ? "Sending…" : "Email me a link"}
        </Button>
      </form>
      {onBack ? (
        <Button variant="link" className="h-11 justify-self-start px-0" onClick={onBack}>
          Back to sign in
        </Button>
      ) : null}
    </section>
  );
}

// ---------- Settings ----------

export type PasskeyItem = { id: string; name: string; createdAt: string; lastUsedAt: string | null; synced: boolean };

/** How you sign in, in Settings: your passkeys, add another, remove one. The server refuses removing the last way in. */
export function PasskeyList({
  passkeys,
  onAdd,
  onRemove,
  canAdd = true,
  className,
}: {
  passkeys: PasskeyItem[];
  onAdd: () => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  /** False where this browser or address can't make passkeys. */
  canAdd?: boolean;
  className?: string;
}) {
  const add = useAction();
  const remove = useAction();
  const [confirm, setConfirm] = React.useState<PasskeyItem | null>(null);
  return (
    <div data-slot="passkey-list" className={cn("grid gap-4", className)}>
      {passkeys.length ? (
        <ul aria-label="Passkeys" className="divide-y rounded-xl border">
          {passkeys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-4 py-3">
              <KeyRound aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {k.name}
                  {k.synced ? <Badge variant="secondary">Synced</Badge> : null}
                </span>
                <span className="text-sm text-muted-foreground">
                  Added {formatDate(k.createdAt)} · {k.lastUsedAt ? `last used ${formatDate(k.lastUsedAt)}` : "not used yet"}
                </span>
              </div>
              <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={`Remove ${k.name}`} onClick={() => setConfirm(k)}>
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No passkeys yet.</p>
      )}
      {passkeys.length === 1 ? (
        <Banner tone="info" title="Add a second passkey">
          On a laptop or tablet, so losing one device doesn't lock you out.
        </Banner>
      ) : null}
      {remove.failed ? <Banner tone="danger" title={remove.failed} /> : null}
      {add.failed ? <Banner tone="danger" title={add.failed} /> : null}
      {canAdd ? (
        <Button variant="outline" className="h-11 justify-self-start" disabled={add.pending} aria-busy={add.pending} onClick={() => add.run(onAdd)}>
          <Fingerprint aria-hidden="true" />
          {add.pending ? "Waiting for your device…" : passkeys.length ? "Add another passkey" : "Add a passkey"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">To add a passkey, open this page at localhost (not 127.0.0.1) or on your phone.</p>
      )}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this passkey?</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.name} won't be able to sign in any more. You'll get an email saying it was removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const k = confirm;
                setConfirm(null);
                if (k) void remove.run(() => onRemove(k.id));
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
