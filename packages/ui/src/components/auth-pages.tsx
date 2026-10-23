import { ChevronRight } from "lucide-react";
import * as React from "react";

import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { Logo } from "./logo";
import { ModeBadge } from "./mode-badge";

// The pages around signing in (portal 03-access-signin, tickets 05, 05b): the sign-in page's frame, the demo's way in,
// and the frame of the page a setup link opens. The forms themselves are sign-in-flows and auth-cards. Presentational:
// props in, callbacks out.

/** The sign-in page: the logo (and the demo badge) across the top, then the form, or the demo's front door when `wide`. */
export function SignInPage({
  demo = false,
  wide = false,
  overlay,
  children,
}: {
  /** Demo mode: shows the demo badge by the logo. */
  demo?: boolean;
  /** The wider column, for the public demo's front door. */
  wide?: boolean;
  /** A dialog that belongs to the page, such as DemoClientPicker. */
  overlay?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
          <Logo size="sm" />
          {demo ? <ModeBadge mode="demo" className="rounded-full" /> : null}
        </div>
      </header>
      {wide ? (
        <main className="mx-auto grid w-full max-w-3xl content-start gap-6 px-4 pt-10 md:pt-16">{children}</main>
      ) : (
        <main className="mx-auto grid w-full max-w-sm content-start gap-6 px-4 pt-10 md:pt-16">{children}</main>
      )}

      {overlay}
    </div>
  );
}

/** The server isn't answering: say so, and offer to try again. */
export function ServerUnreachable({
  message = "Can't reach the server right now. Try again in a moment.",
  onRetry,
}: {
  message?: React.ReactNode;
  onRetry: () => void;
}) {
  return (
    <div className="grid gap-3 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="touch" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** Under the sign-in form in demo mode: "or", then a way to pick one of the invented clients. */
export function DemoSignInOption({
  onPick,
  label = "Sign in as a demo client",
  note = "The demo uses invented households. Nothing you do is kept: it resets every time it starts.",
}: {
  onPick: () => void;
  label?: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" size="touch" onClick={onPick}>
        {label}
      </Button>
      <p className="text-center text-sm text-muted-foreground">{note}</p>
    </>
  );
}

export type DemoClient = { id: string; name: string; household?: string };

/** The demo's invented clients to sign in as, one row each, in a dialog. */
export function DemoClientPicker({
  open,
  onOpenChange,
  clients = [],
  onPick,
  title = "Choose a demo client",
  description = "Every household here is invented. Each one is at a different point in its return.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients?: DemoClient[];
  onPick: (id: string) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80svh] grid-rows-[auto_1fr] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ul className="overflow-y-auto border-t">
          {clients.map((c) => (
            <li key={c.id} className="border-b last:border-b-0">
              <button
                type="button"
                className="flex min-h-14 w-full items-center gap-3 px-6 py-3 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                onClick={() => onPick(c.id)}
              >
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">{c.name}</span>
                  {c.household ? <span className="truncate text-sm text-muted-foreground">{c.household} household</span> : null}
                </span>
                <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** The page a setup link (an invite, or "Lost your passkey?") opens: one narrow column, centred. */
export function LinkPage({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto grid min-h-svh w-full max-w-sm content-center px-4 py-10">{children}</main>;
}
