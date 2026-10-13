import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";

import { InviteWelcome, LinkGone, SetPasswordForm } from "@app/ui/components/auth-cards";
import { MarkLoader } from "@app/ui/components/logo";

import { authPost, linkInfo, type LinkInfo } from "@/lib/auth";
import { trpc } from "@/lib/trpc";

// The preparer's own one-time link (bun run preparer:invite, ticket 05): set the password, then you're in.
export default function Invite() {
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
    <main className="grid min-h-svh place-items-center bg-muted/40 p-4">
      {info === undefined ? (
        <MarkLoader label="Checking your link" />
      ) : info === null ? (
        <LinkGone onSignIn={() => navigate("/login")} />
      ) : step === "welcome" ? (
        <InviteWelcome preparerName={info.preparerName} practiceName={info.practiceName} email={info.email} onAccept={() => setStep("password")} onSignIn={() => navigate("/login")} />
      ) : (
        <SetPasswordForm
          email={info.email}
          onSubmit={async (password) => {
            const r = await authPost(`/api/auth/link/${token}`, { password });
            if (!r.ok) throw new Error(r.error);
            await utils.invalidate();
            navigate("/dashboard");
          }}
        />
      )}
    </main>
  );
}
