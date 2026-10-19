import { ChevronRight } from "lucide-react";
import * as React from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@app/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@app/ui/components/dialog";
import { Logo, MarkLoader } from "@app/ui/components/logo";
import { ModeBadge } from "@app/ui/components/mode-badge";
import { SignInSteps } from "@app/ui/components/sign-in-flows";
import { DemoFrontDoor } from "@app/ui/components/demo-tour";
import { setDemoUser } from "@app/ui/demo";

import { auth } from "@/lib/auth";
import { useDemoTour } from "@/lib/demo-tour";

import { usePageTitle } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// Sign in (portal 03-access-signin, tickets 05, 05b): a passkey first, or a password and the app's code. In demo mode the picker of invented clients sits
// underneath; on the public demo the front door replaces the form.
export default function SignIn() {
  usePageTitle("Sign in");
  const navigate = useNavigate();
  const [picking, setPicking] = React.useState(false);
  const users = trpc.demo.users.useQuery(undefined, { retry: false });
  const demo = !!users.data;
  const tour = useDemoTour();
  const utils = trpc.useUtils();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
          <Logo size="sm" />
          {demo ? <ModeBadge mode="demo" className="rounded-full" /> : null}
        </div>
      </header>
      {tour?.client ? (
        <main className="mx-auto grid w-full max-w-3xl content-start gap-6 px-4 pt-10 md:pt-16">
          <DemoFrontDoor
            clientName={tour.client.name}
            onClient={() => {
              setDemoUser("portal", tour.client!.id);
              void utils.invalidate().then(() => navigate("/"));
            }}
            onAgent={() => {
              if (tour.preparerId) setDemoUser("admin", tour.preparerId);
              location.assign("/admin/");
            }}
            onPickAny={() => setPicking(true)}
          />
        </main>
      ) : (
      <main className="mx-auto grid w-full max-w-sm content-start gap-6 px-4 pt-10 md:pt-16">
        <SignInSteps
          description="See where your return stands and what's needed from you."
          signIn={auth.signIn}
          onPasskey={auth.signInWithPasskey}
          recover={auth.recover}
          onDone={async () => {
            await utils.invalidate();
            navigate("/");
          }}
          onSetup={(token) => navigate(`/invite/${token}`)}
        />
        {users.isLoading ? <MarkLoader label="Loading" className="py-4" /> : null}
        {/* NOT_FOUND means live mode (no demo); anything else means the server isn't answering. */}
        {users.error && users.error.data?.code !== "NOT_FOUND" ? (
          <div className="grid gap-3 text-center">
            <p className="text-sm text-muted-foreground">Can't reach the server right now. Try again in a moment.</p>
            <Button variant="outline" size="touch" onClick={() => users.refetch()}>
              Try again
            </Button>
          </div>
        ) : null}
        {demo ? (
          <>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" size="touch" onClick={() => setPicking(true)}>
              Sign in as a demo client
            </Button>
            <p className="text-center text-sm text-muted-foreground">The demo uses invented households. Nothing you do is kept: it resets every time it starts.</p>
          </>
        ) : null}
      </main>
      )}

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="max-h-[80svh] grid-rows-[auto_1fr] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Choose a demo client</DialogTitle>
            <DialogDescription>Every household here is invented. Each one is at a different point in its return.</DialogDescription>
          </DialogHeader>
          <ul className="overflow-y-auto border-t">
            {users.data?.map((u) => {
              const [name, household] = u.label.split(" · ");
              return (
                <li key={u.id} className="border-b last:border-b-0">
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center gap-3 px-6 py-3 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                    onClick={() => {
                      setDemoUser("portal", u.id);
                      void utils.invalidate().then(() => navigate("/"));
                    }}
                  >
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate font-medium">{name}</span>
                      {household ? <span className="truncate text-sm text-muted-foreground">{household} household</span> : null}
                    </span>
                    <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
