import { useNavigate } from "react-router-dom";

import { Button } from "@app/ui/components/button";
import { Logo } from "@app/ui/components/logo";
import { ModeBadge } from "@app/ui/components/mode-badge";
import { SignInSteps } from "@app/ui/components/sign-in-flows";
import { setDemoUser } from "@app/ui/demo";

import { auth } from "@/lib/auth";
import { trpc } from "@/lib/trpc";

// Sign in (admin 01-access-signin, tickets 05, 05b): a passkey, or the password and then the app's code (or a
// recovery code). In demo mode the picker sits
// underneath, so a walkthrough is one click; in live mode there is no picker at all.
export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const users = trpc.demo.users.useQuery(undefined, { retry: false });
  const preparers = users.data?.filter((u) => u.role === "preparer") ?? [];
  const enter = async () => {
    await utils.invalidate();
    navigate("/dashboard");
  };

  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <div className="grid w-full max-w-sm gap-6 rounded-xl border bg-card p-6 shadow-sm">
        <Logo className="mx-auto" />
        <SignInSteps
          title="Sign in"
          description="The back office for your practice."
          signIn={auth.signIn}
          onPasskey={auth.signInWithPasskey}
          recover={auth.recover}
          onDone={enter}
          onSetup={(token) => navigate(`/invite/${token}`)}
        >
          {preparers.length ? (
            <div className="grid gap-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or, in the demo
                <span className="h-px flex-1 bg-border" />
              </div>
              {preparers.map((u) => (
                <Button
                  key={u.id}
                  variant="outline"
                  size="touch"
                  onClick={() => {
                    setDemoUser("admin", u.id);
                    void enter();
                  }}
                >
                  Continue as {u.label}
                </Button>
              ))}
              <ModeBadge mode="demo" />
            </div>
          ) : null}
        </SignInSteps>
      </div>
    </main>
  );
}
