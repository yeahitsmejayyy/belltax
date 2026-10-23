import * as React from "react";

import { PreparerSignIn } from "@app/ui/components/admin-settings";

import { auth } from "@/lib/auth";
import { trpc } from "@/lib/trpc";

import { serverMessage } from "./server-error";

// Settings › Sign-in (ticket 05b): the preparer's passkeys, authenticator app and recovery codes. A new set of codes is
// shown once, in a dialog, and the old set stops working.
export function SignInTab() {
  const methods = trpc.mfa.methods.useQuery();
  const utils = trpc.useUtils();
  const remove = trpc.mfa.removePasskey.useMutation();
  const newCodes = trpc.mfa.newRecoveryCodes.useMutation();
  const [codes, setCodes] = React.useState<string[] | null>(null);

  return (
    <PreparerSignIn
      methods={methods.data}
      canAddPasskey={auth.passkeysSupported()}
      onAddPasskey={async () => {
        await auth.addPasskey();
        await utils.mfa.methods.invalidate();
      }}
      onRemovePasskey={async (passkeyId) => {
        await remove.mutateAsync({ passkeyId });
        await utils.mfa.methods.invalidate();
      }}
      makingCodes={newCodes.isPending}
      codesError={newCodes.error ? serverMessage(newCodes.error) : null}
      onMakeCodes={async () => {
        const r = await newCodes.mutateAsync();
        setCodes(r.codes);
        await utils.mfa.methods.invalidate();
      }}
      codes={codes}
      onCodesDone={() => setCodes(null)}
    />
  );
}
