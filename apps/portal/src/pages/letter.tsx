import { Ban, CheckCircle2, Clock, FileClock, PenLine } from "lucide-react";

import { EmptyState } from "@app/ui/components/empty-state";
import { PageHeader } from "@app/ui/components/page-header";
import { Skeleton } from "@app/ui/components/skeleton";
import { StatusChip } from "@app/ui/components/status-chip";

import { LetterBody } from "@/components/letter/letter-body";
import { SignForm } from "@/components/letter/sign-form";
import { SignedCard } from "@/components/letter/signed-card";
import { usePageTitle, useReturn } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// The engagement letter (portal 14-letter, 15-letter-errors, 16-letter-signed): read it, type your name,
// agree, sign. Once you've signed, the confirmation and who else still has to.

export default function Letter() {
  usePageTitle("Letter");
  const { current, loading } = useReturn();
  const id = current?.engagementId;
  const q = trpc.letter.get.useQuery({ engagementId: id! }, { enabled: !!id });
  const preparer = trpc.practice.public.useQuery(undefined, { staleTime: Infinity }).data?.preparerName.split(/\s+/)[0] ?? "Your preparer";

  if (!loading && !current) return <EmptyState icon={FileClock} title="No return yet" description="Your engagement letter shows up here once your return is opened." />;
  if (!id || q.isLoading) return <Skeleton aria-label="Loading your letter" className="h-96 rounded-xl" />;

  const letter = q.data;
  if (!letter || letter.status === "draft") {
    return <EmptyState icon={FileClock} title="Your letter isn't ready yet" description={`${preparer} will send your engagement letter here. Nothing to do until then.`} />;
  }
  if (letter.status === "void") {
    return <EmptyState icon={Ban} title="This letter was withdrawn" description={`${preparer} will send you a new one to sign. Nothing to do until then.`} />;
  }

  const me = letter.signers.find((s) => s.isMe);
  if (me?.signedAt) {
    return (
      <div className="grid grid-cols-1 content-start gap-8">
        <SignedCard letter={letter} me={me} />
        <details className="group max-w-[70ch] rounded-xl border bg-card">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">Read the letter again</summary>
          <LetterBody body={letter.body} className="px-4 pb-6" />
        </details>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 content-start gap-6">
      <PageHeader title="Engagement letter" description={`This explains what ${preparer} will do for you and what it costs. Read it, then sign below.`} />

      <div tabIndex={0} aria-label="Letter text, scrollable" className="max-h-[60svh] max-w-[70ch] overflow-y-auto rounded-xl border bg-card px-5 py-6 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none md:px-8">
        <LetterBody body={letter.body} />
      </div>

      {letter.signers.length > 1 ? (
        <section aria-label="Who signs" className="grid max-w-xl gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Everyone filing signs</h2>
          <ul className="grid gap-2">
            {letter.signers.map((s) => (
              <li key={s.personId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{s.isMe ? `${s.name} (you)` : s.name}</span>
                {s.signedAt ? <StatusChip tone="success" icon={CheckCircle2} label="Signed" /> : <StatusChip tone="neutral" icon={Clock} label="Not signed yet" />}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {letter.canSign ? (
        <SignForm key={letter.bodySha256} letter={letter} />
      ) : (
        <EmptyState
          icon={PenLine}
          title={letter.status === "signed" ? "Everyone has signed" : "Signed by the people filing"}
          description={letter.status === "signed" ? "Nothing more to do here." : "Only the people filing these returns sign this letter. You can read it here."}
          className="max-w-xl"
        />
      )}
    </div>
  );
}
