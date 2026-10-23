import * as React from "react";
import { useNavigate } from "react-router-dom";

import { DemoClientPicker, DemoSignInOption, ServerUnreachable, SignInPage } from "@app/ui/components/auth-pages";
import { MarkLoader } from "@app/ui/components/logo";
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

  const pickClient = (id: string) => {
    setDemoUser("portal", id);
    void utils.invalidate().then(() => navigate("/"));
  };

  return (
    <SignInPage
      demo={demo}
      wide={!!tour?.client}
      overlay={
        <DemoClientPicker
          open={picking}
          onOpenChange={setPicking}
          clients={users.data?.map((u) => {
            const [name = u.label, household] = u.label.split(" · ");
            return { id: u.id, name, household };
          })}
          onPick={pickClient}
        />
      }
    >
      {tour?.client ? (
        <DemoFrontDoor
          clientName={tour.client.name}
          onClient={() => pickClient(tour.client!.id)}
          onAgent={() => {
            if (tour.preparerId) setDemoUser("admin", tour.preparerId);
            location.assign("/admin/");
          }}
          onPickAny={() => setPicking(true)}
        />
      ) : (
        <>
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
          {users.error && users.error.data?.code !== "NOT_FOUND" ? <ServerUnreachable onRetry={() => users.refetch()} /> : null}
          {demo ? <DemoSignInOption onPick={() => setPicking(true)} /> : null}
        </>
      )}
    </SignInPage>
  );
}
