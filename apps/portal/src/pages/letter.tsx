import type { LetterView } from "@app/schema";
import * as React from "react";
import { toast } from "sonner";

import { LetterScreen, SignLetterForm } from "@app/ui/components/letter";

import { usePageTitle, useReturn } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// The engagement letter (portal 14-letter, 15-letter-errors, 16-letter-signed): fetch it and wire signing. The screen
// is LetterScreen from the design system.

// letter.sign for the text on screen; if the letter changed, the server says so and the letter is fetched again.
// Keyed by the letter's hash, so a changed letter starts a fresh form (and a fresh mutation).
function SignLetter({ letter }: { letter: LetterView }) {
  const utils = trpc.useUtils();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const sign = trpc.letter.sign.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.letter.get.invalidate(), utils.engagement.mine.invalidate()]);
      toast.success("Letter signed", { description: "Thank you. Your preparer can see it now." });
    },
    onError: (e) => {
      setServerError(e.message);
      if (e.data?.code === "CONFLICT") void utils.letter.get.invalidate();
    },
  });
  return (
    <SignLetterForm
      consentText={letter.consentText}
      pending={sign.isPending}
      error={serverError}
      onSubmitStart={() => setServerError(null)}
      onSign={(typedName) => sign.mutate({ letterId: letter.id, typedName, consent: true, bodySha256: letter.bodySha256 })}
    />
  );
}

export default function Letter() {
  usePageTitle("Letter");
  const { current, loading } = useReturn();
  const id = current?.engagementId;
  const q = trpc.letter.get.useQuery({ engagementId: id! }, { enabled: !!id });
  const preparer = trpc.practice.public.useQuery(undefined, { staleTime: Infinity }).data?.preparerName.split(/\s+/)[0] ?? "Your preparer";

  return (
    <LetterScreen
      noReturn={!loading && !current}
      loading={!id || q.isLoading}
      letter={q.data}
      preparer={preparer}
      renderSignForm={(letter) => <SignLetter key={letter.bodySha256} letter={letter} />}
    />
  );
}
