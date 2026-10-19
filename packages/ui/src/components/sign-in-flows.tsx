import * as React from "react";

import { InviteWelcome, SetPasswordForm, SignInForm } from "./auth-cards";
import { MarkLoader } from "./logo";
import { AuthenticatorSetup, CodeStep, LostPasskey, PasskeySetup, RecoveryCodes } from "./mfa-cards";

// The two ways in, as steps (ticket 05b), shared by the portal and the admin. Still presentational: every server call is
// a callback the app passes in (its auth client), so stories can drive them with invented answers.

export type SignInStep = { done: true } | { done: false; next: "code"; recoveryCodes: boolean } | { done: false; next: "setup"; token: string };

/** Sign in: a passkey first, or a password and then the app's code. "Lost your passkey?" swaps in the recovery form. */
export function SignInSteps({
  title,
  description,
  signIn,
  onPasskey,
  recover,
  onDone,
  onSetup,
  children,
}: {
  title?: string;
  description?: React.ReactNode;
  signIn: (email: string, password: string, code?: string) => Promise<SignInStep>;
  onPasskey: () => Promise<void>;
  recover: (email: string) => Promise<void>;
  onDone: () => void | Promise<void>;
  /** A login from before 05b with only a password: send them to set up, with the link the server just made. */
  onSetup: (token: string) => void;
  children?: React.ReactNode;
}) {
  const [step, setStep] = React.useState<{ at: "form" } | { at: "code"; email: string; password: string; recoveryCodes: boolean } | { at: "lost" }>({ at: "form" });
  const after = async (r: SignInStep, email: string, password: string) => {
    if (r.done) return onDone();
    if (r.next === "setup") return onSetup(r.token);
    setStep({ at: "code", email, password, recoveryCodes: r.recoveryCodes });
  };
  if (step.at === "code")
    return (
      <CodeStep
        email={step.email}
        recoveryCodes={step.recoveryCodes}
        onSubmit={async (code) => {
          const r = await signIn(step.email, step.password, code);
          if (r.done) await onDone();
        }}
        onBack={() => setStep({ at: "form" })}
      />
    );
  if (step.at === "lost") return <LostPasskey onSubmit={recover} onBack={() => setStep({ at: "form" })} />;
  return (
    <SignInForm
      title={title}
      description={description}
      onPasskey={async () => {
        await onPasskey();
        await onDone();
      }}
      onSubmit={async (email, password) => after(await signIn(email, password), email, password)}
      onLost={() => setStep({ at: "lost" })}
    >
      {children}
    </SignInForm>
  );
}

export type LinkSetupInfo = { purpose: "invite" | "reset"; email: string; practiceName: string; preparerName: string; role: "client" | "preparer" };
export type LinkSetupOptions<P> = { passkey: P | null; totp: { secret: string; uri: string } };

/**
 * Setting up from a link. A client: a passkey, or (if the device can't) a password and an authenticator app. The
 * preparer: a passkey, then a password and the app, then recovery codes. Nothing is saved until the last step.
 */
export function LinkSetupSteps<P>({
  info,
  passkeysSupported,
  loadOptions,
  makePasskey,
  finish,
  onDone,
  onSignIn,
}: {
  info: LinkSetupInfo;
  passkeysSupported: boolean;
  loadOptions: () => Promise<LinkSetupOptions<P>>;
  makePasskey: (options: P) => Promise<unknown>;
  finish: (setup: { passkey?: unknown; password?: string; code?: string }) => Promise<{ recoveryCodes?: string[] }>;
  onDone: () => void | Promise<void>;
  onSignIn?: () => void;
}) {
  const preparer = info.role === "preparer";
  type Step = "welcome" | "loading" | "passkey" | "password" | "app" | "codes";
  const [step, setStep] = React.useState<Step>(info.purpose === "invite" ? "welcome" : "loading");
  const [options, setOptions] = React.useState<LinkSetupOptions<P> | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [passkey, setPasskey] = React.useState<unknown>(undefined);
  const [password, setPassword] = React.useState("");
  const [codes, setCodes] = React.useState<string[]>([]);
  const count = preparer ? " of 3" : " of 2";

  const begin = React.useCallback(async () => {
    setStep("loading");
    try {
      setOptions(await loadOptions());
      setStep("passkey");
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "That didn't work. Try again.");
    }
  }, [loadOptions]);
  React.useEffect(() => {
    if (info.purpose === "reset") void begin();
  }, [info.purpose, begin]);

  if (failed) return <p className="text-center text-muted-foreground">{failed}</p>;
  if (step === "welcome") return <InviteWelcome preparerName={info.preparerName} practiceName={info.practiceName} email={info.email} onAccept={() => void begin()} onSignIn={onSignIn} />;
  if (step === "loading" || !options) return <MarkLoader label="Getting things ready" />;
  if (step === "passkey")
    return (
      <PasskeySetup
        purpose={info.purpose}
        available={passkeysSupported && !!options.passkey}
        step={preparer ? `Step 1${count}` : undefined}
        onCreate={async () => {
          const made = await makePasskey(options.passkey!);
          if (preparer) {
            setPasskey(made);
            setStep("password");
          } else {
            await finish({ passkey: made });
            await onDone();
          }
        }}
        onFallback={preparer ? undefined : () => setStep("password")}
      />
    );
  if (step === "password")
    return (
      <SetPasswordForm
        email={info.email}
        title="Choose a password"
        step={`Step ${preparer ? 2 : 1}${count}`}
        submitLabel="Continue"
        pendingLabel="Continuing…"
        onSubmit={(pw) => {
          setPassword(pw);
          setStep("app");
        }}
      />
    );
  if (step === "app")
    return (
      <AuthenticatorSetup
        secret={options.totp.secret}
        uri={options.totp.uri}
        step={`Step ${preparer ? 3 : 2}${count}`}
        onSubmit={async (code) => {
          const r = await finish({ passkey, password, code });
          if (preparer && r.recoveryCodes) {
            setCodes(r.recoveryCodes);
            setStep("codes");
          } else await onDone();
        }}
      />
    );
  return <RecoveryCodes codes={codes} doneLabel="Go to the dashboard" onDone={() => void onDone()} />;
}
