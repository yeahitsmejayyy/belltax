import { Button } from "@app/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { ModeToggle } from "@app/ui/components/mode-toggle";
import { formatDate } from "@app/ui/format";

import type { RouterOutputs } from "@/lib/trpc";

// Sign-in and appearance (portal 21-…-settings). Changing a password arrives with real sign-in (ticket 05).

type Me = RouterOutputs["me"]["get"];

export function SignInCard({ signIn }: { signIn: Me["signIn"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Sign-in</h2>
        </CardTitle>
        <CardDescription>
          {signIn.method === "demo" ? "You're using the demo. Sign-in with a password arrives with your invite." : "You sign in with your email and a password."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {signIn.activatedAt ? <p className="text-sm">Account active since {formatDate(signIn.activatedAt)}</p> : null}
        <div className="grid gap-1.5">
          <Button variant="outline" size="touch" className="w-fit" disabled aria-describedby="change-password-hint">
            Change password
          </Button>
          <p id="change-password-hint" className="text-xs text-muted-foreground">
            Coming with sign-in.
          </p>
        </div>
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
