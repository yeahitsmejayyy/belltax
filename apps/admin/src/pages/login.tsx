import { useNavigate } from "react-router-dom";

import { AdminSignInPage, DemoPreparerOption } from "@app/ui/components/admin-auth-pages";
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
    <AdminSignInPage>
      <SignInSteps
        title="Sign in"
        description="The back office for your practice."
        signIn={auth.signIn}
        onPasskey={auth.signInWithPasskey}
        recover={auth.recover}
        onDone={enter}
        onSetup={(token) => navigate(`/invite/${token}`)}
      >
        <DemoPreparerOption
          preparers={preparers}
          onPick={(id) => {
            setDemoUser("admin", id);
            void enter();
          }}
        />
      </SignInSteps>
    </AdminSignInPage>
  );
}
