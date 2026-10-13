import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";

import { InviteWelcome, LinkGone, SetPasswordForm } from "@app/ui/components/auth-cards";
import { MarkLoader } from "@app/ui/components/logo";

import { authPost, linkInfo, type LinkInfo } from "@/lib/auth";
import { usePageTitle } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// The link a client gets from their tax agent (portal 01-access-invite → 02-access-setpw, ticket 05): an invite
// welcomes them first; a reset goes straight to the new password. Either way they land signed in.
export default function Invite() {
  usePageTitle("Set up your account");
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [info, setInfo] = React.useState<LinkInfo | null | undefined>(undefined);
  const [step, setStep] = React.useState<"welcome" | "password">("welcome");
  React.useEffect(() => {
    void linkInfo(token).then((i) => {
      setInfo(i);
      if (i?.purpose === "reset") setStep("password");
    });
  }, [token]);

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-sm content-center px-4 py-10">
      {info === undefined ? (
        <MarkLoader label="Checking your link" />
      ) : info === null ? (
        <LinkGone onSignIn={() => navigate("/sign-in")} />
      ) : step === "welcome" ? (
        <InviteWelcome preparerName={info.preparerName} practiceName={info.practiceName} email={info.email} onAccept={() => setStep("password")} onSignIn={() => navigate("/sign-in")} />
      ) : (
        <SetPasswordForm
          email={info.email}
          onSubmit={async (password) => {
            const r = await authPost(`/api/auth/link/${token}`, { password });
            if (!r.ok) throw new Error(r.error);
            await utils.invalidate();
            navigate("/");
          }}
        />
      )}
    </main>
  );
}
