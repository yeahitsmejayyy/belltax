import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";

import { LinkGone } from "@app/ui/components/auth-cards";
import { MarkLoader } from "@app/ui/components/logo";
import { LinkSetupSteps } from "@app/ui/components/sign-in-flows";

import { auth, type LinkInfo } from "@/lib/auth";
import { usePageTitle } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// The link a client gets from their tax agent, or asks for with "Lost your passkey?" (tickets 05, 05b): an invite
// welcomes them first; then a passkey, or a password and an authenticator app. Either way they land signed in.
export default function Invite() {
  usePageTitle("Set up your account");
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [info, setInfo] = React.useState<LinkInfo | null | undefined>(undefined);
  React.useEffect(() => {
    void auth.linkInfo(token).then(setInfo);
  }, [token]);
  const loadOptions = React.useCallback(() => auth.linkOptions(token), [token]);

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-sm content-center px-4 py-10">
      {info === undefined ? (
        <MarkLoader label="Checking your link" />
      ) : info === null ? (
        <LinkGone onSignIn={() => navigate("/sign-in")} />
      ) : (
        <LinkSetupSteps
          info={info}
          passkeysSupported={auth.passkeysSupported()}
          loadOptions={loadOptions}
          makePasskey={auth.makePasskey}
          finish={(setup) => auth.finishLink(token, setup)}
          onDone={async () => {
            await utils.invalidate();
            navigate("/");
          }}
          onSignIn={() => navigate("/sign-in")}
        />
      )}
    </main>
  );
}
