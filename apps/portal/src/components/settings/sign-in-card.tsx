import { Smartphone } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { PasskeyList } from "@app/ui/components/mfa-cards";
import { ModeToggle } from "@app/ui/components/mode-toggle";
import { Skeleton } from "@app/ui/components/skeleton";
import { formatDate } from "@app/ui/format";

import { auth } from "@/lib/auth";
import { trpc, type RouterOutputs } from "@/lib/trpc";

// Sign-in and appearance (portal 21-…-settings). How you sign in (ticket 05b): your passkeys, add another, remove one.

type Me = RouterOutputs["me"]["get"];

export function SignInCard({ signIn }: { signIn: Me["signIn"] }) {
  const methods = trpc.mfa.methods.useQuery();
  const utils = trpc.useUtils();
  const remove = trpc.mfa.removePasskey.useMutation();
  const m = methods.data;
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
              : signIn.method === "demo"
                ? "You're using the demo. You can still try adding a passkey here."
                : "Add a passkey to sign in with your face or fingerprint."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {signIn.activatedAt ? <p className="text-sm">Account active since {formatDate(signIn.activatedAt)}</p> : null}
        {m ? (
          <>
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

export function AppearanceCard() {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground">Light, dark, or follow your device.</p>
        </div>
        <ModeToggle variant="menu" className="size-11" />
      </CardContent>
    </Card>
  );
}
