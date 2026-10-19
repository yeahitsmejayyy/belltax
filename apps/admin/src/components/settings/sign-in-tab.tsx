import { KeyRound, Smartphone } from "lucide-react";
import * as React from "react";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { Dialog, DialogContent, DialogTitle } from "@app/ui/components/dialog";
import { PasskeyList, RecoveryCodes } from "@app/ui/components/mfa-cards";
import { Skeleton } from "@app/ui/components/skeleton";

import { auth } from "@/lib/auth";
import { trpc } from "@/lib/trpc";

import { serverMessage } from "./server-error";

// Settings › Sign-in (ticket 05b): the preparer's passkeys, authenticator app and recovery codes. A new set of codes is
// shown once, in a dialog, and the old set stops working.
export function SignInTab() {
  const methods = trpc.mfa.methods.useQuery();
  const utils = trpc.useUtils();
  const remove = trpc.mfa.removePasskey.useMutation();
  const newCodes = trpc.mfa.newRecoveryCodes.useMutation();
  const [codes, setCodes] = React.useState<string[] | null>(null);
  const m = methods.data;
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
          <PasskeyList
            passkeys={m.passkeys}
            canAdd={auth.passkeysSupported()}
            onAdd={async () => {
              await auth.addPasskey();
              await utils.mfa.methods.invalidate();
            }}
            onRemove={async (passkeyId) => {
              await remove.mutateAsync({ passkeyId });
              await utils.mfa.methods.invalidate();
            }}
          />
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
          {!m.authenticatorApp ? <p className="text-muted-foreground">To set it up, use “Lost your passkey?” on the sign-in page, or run bun run preparer:invite.</p> : null}
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
            {left} of 10 left
          </p>
          {left <= 3 ? <Banner tone="warning" title={left ? "You're running low." : "You have no recovery codes."}>Make a new set and keep it somewhere safe.</Banner> : null}
          {newCodes.error ? <Banner tone="danger" title={serverMessage(newCodes.error)} /> : null}
          <Button
            variant="outline"
            className="h-11 justify-self-start"
            disabled={newCodes.isPending}
            onClick={async () => {
              const r = await newCodes.mutateAsync();
              setCodes(r.codes);
              await utils.mfa.methods.invalidate();
            }}
          >
            {newCodes.isPending ? "Making new codes…" : "Make new codes"}
          </Button>
          <p className="text-xs text-muted-foreground">Your old codes stop working as soon as new ones are made.</p>
        </CardContent>
      </Card>

      <Dialog open={!!codes} onOpenChange={() => undefined}>
        <DialogContent className="sm:max-w-md" showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogTitle className="sr-only">New recovery codes</DialogTitle>
          {codes ? <RecoveryCodes codes={codes} doneLabel="Done" onDone={() => setCodes(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
