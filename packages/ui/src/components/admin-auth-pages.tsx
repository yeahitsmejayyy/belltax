import * as React from "react";

import { Button } from "./button";
import { Logo } from "./logo";
import { ModeBadge } from "./mode-badge";

// The pages around the preparer signing in (admin 01-access-signin, tickets 05, 05b): the muted backdrop every one of
// them sits on, the sign-in card with the logo, and the demo's way in. The forms themselves are sign-in-flows and
// auth-cards. Presentational: props in, callbacks out.

/** The backdrop of the admin's sign-in and setup-link pages: whatever it holds, centred on a muted page. */
export function AdminAuthPage({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-svh place-items-center bg-muted/40 p-4">{children}</main>;
}

/** The admin's sign-in page: the logo above the form (SignInSteps), in one card. */
export function AdminSignInPage({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthPage>
      <div className="grid w-full max-w-sm gap-6 rounded-xl border bg-card p-6 shadow-sm">
        <Logo className="mx-auto" />
        {children}
      </div>
    </AdminAuthPage>
  );
}

export type DemoPreparer = { id: string; label: string };

/** Under the sign-in form in demo mode: "or, in the demo", then one button per invented preparer. Nothing when there are none. */
export function DemoPreparerOption({
  preparers,
  onPick,
  divider = "or, in the demo",
}: {
  preparers: DemoPreparer[];
  onPick: (id: string) => void;
  divider?: React.ReactNode;
}) {
  if (!preparers.length) return null;
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {divider}
        <span className="h-px flex-1 bg-border" />
      </div>
      {preparers.map((u) => (
        <Button key={u.id} variant="outline" size="touch" onClick={() => onPick(u.id)}>
          Continue as {u.label}
        </Button>
      ))}
      <ModeBadge mode="demo" />
    </div>
  );
}
