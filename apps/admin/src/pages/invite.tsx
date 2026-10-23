import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";

import { AdminAuthPage } from "@app/ui/components/admin-auth-pages";
import { LinkGone } from "@app/ui/components/auth-cards";
import { MarkLoader } from "@app/ui/components/logo";
import { LinkSetupSteps } from "@app/ui/components/sign-in-flows";

import { auth, type LinkInfo } from "@/lib/auth";
import { trpc } from "@/lib/trpc";

// The preparer's own one-time link (bun run preparer:invite, or "Lost your passkey?"; tickets 05, 05b): a passkey,
// then a password and an authenticator app, then recovery codes. Then you're in.
export default function Invite() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [info, setInfo] = React.useState<LinkInfo | null | undefined>(undefined);
  React.useEffect(() => {
    void auth.linkInfo(token).then(setInfo);
  }, [token]);
  const loadOptions = React.useCallback(() => auth.linkOptions(token), [token]);

  return (
    <AdminAuthPage>
      {info === undefined ? (
        <MarkLoader label="Checking your link" />
      ) : info === null ? (
        <LinkGone onSignIn={() => navigate("/login")} />
      ) : (
        <LinkSetupSteps
          info={info}
          passkeysSupported={auth.passkeysSupported()}
          loadOptions={loadOptions}
          makePasskey={auth.makePasskey}
          finish={(setup) => auth.finishLink(token, setup)}
          onDone={async () => {
            await utils.invalidate();
            navigate("/dashboard");
          }}
          onSignIn={() => navigate("/login")}
        />
      )}
    </AdminAuthPage>
  );
}
