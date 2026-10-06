import { useNavigate } from "react-router-dom";

import { Button } from "@app/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { Logo, MarkLoader } from "@app/ui/components/logo";
import { ModeBadge } from "@app/ui/components/mode-badge";
import { setDemoUser } from "@app/ui/demo";

import { trpc } from "@/lib/trpc";

// Sign in (admin 01-access-signin). Until auth (ticket 05) it's the demo shortcut: pick who to be.
// Email and password arrive with auth.
export default function Login() {
  const navigate = useNavigate();
  const users = trpc.demo.users.useQuery(undefined, { retry: false });
  const preparers = users.data?.filter((u) => u.role === "preparer") ?? [];

  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo subtitle="Preparer admin" className="mx-auto mb-2" />
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription>Email and password arrive with sign-in. For the demo, choose who to be.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {users.isLoading ? <MarkLoader label="Loading" className="py-6" /> : null}
          {users.error ? <p className="text-sm text-muted-foreground">Sign-in arrives with auth. There's no demo sign-in in live mode.</p> : null}
          {preparers.map((u) => (
            <Button
              key={u.id}
              size="touch"
              className="w-full"
              onClick={() => {
                setDemoUser("admin", u.id);
                navigate("/dashboard");
              }}
            >
              Continue as {u.label}
            </Button>
          ))}
          {users.data ? <ModeBadge mode="demo" /> : null}
        </CardContent>
      </Card>
    </main>
  );
}
