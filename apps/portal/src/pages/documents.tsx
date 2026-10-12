import type { DocumentView } from "@app/schema";
import { FolderCheck, FolderOpen } from "lucide-react";

import { Banner } from "@app/ui/components/banner";
import { EmptyState } from "@app/ui/components/empty-state";
import { FileDropzone, UploadList } from "@app/ui/components/file-dropzone";
import { PageHeader, SectionHeader } from "@app/ui/components/page-header";
import { Progress } from "@app/ui/components/progress";
import { Skeleton } from "@app/ui/components/skeleton";

import { MyUpload } from "@/components/documents/my-upload";
import { QuestionCard } from "@/components/documents/question-card";
import { DocRow, RejectedNote, RequestRow, requestStatus } from "@/components/documents/request-row";
import { SampleButton } from "@/components/documents/sample-button";
import { useDocumentUploads } from "@/components/documents/use-upload";
import { useDemoTour } from "@/lib/demo-tour";
import { usePageTitle, useReturn } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// Documents (portal 13-documents, desktop 23-desktop-d-documents): what the preparer asked for, grouped by
// where it stands, an upload on every row, questions answered in place, and room for anything else.

const List = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <ul aria-label={label} className="divide-y overflow-hidden rounded-xl border bg-card">
    {children}
  </ul>
);

export default function Documents() {
  const publicDemo = !!useDemoTour();
  usePageTitle("Documents");
  const { current, loading } = useReturn();
  const id = current?.engagementId;
  const requests = trpc.request.list.useQuery({ engagementId: id! }, { enabled: !!id });
  const documents = trpc.document.list.useQuery({ engagementId: id! }, { enabled: !!id });
  const letter = trpc.letter.get.useQuery({ engagementId: id! }, { enabled: !!id });
  const practice = trpc.practice.public.useQuery(undefined, { staleTime: Infinity }).data;
  const myPersonId = trpc.me.get.useQuery(undefined, { staleTime: 60_000 }).data?.personId;
  const extra = useDocumentUploads({ engagementId: id ?? "", kind: "other" });

  if (!loading && !current) return <EmptyState icon={FolderOpen} title="No return yet" description="Once your preparer opens your return, what they need from you shows up here." />;
  if (!requests.data || !documents.data) return <Skeleton aria-label="Loading your documents" className="h-96 rounded-xl" />;

  const preparer = practice?.preparerName.split(/\s+/)[0] ?? "Your preparer";
  const names = new Map(letter.data?.signers.map((s) => [s.personId, s.isMe ? "you" : s.name.split(/\s+/)[0]!]) ?? []);
  const who = (personId: string | null) => (personId ? (personId === myPersonId ? "you" : (names.get(personId) ?? null)) : null);
  const filesFor = (requestId: string): DocumentView[] => documents.data!.filter((d) => d.requestId === requestId);

  const docRequests = requests.data.filter((r) => r.kind === "document" && r.status !== "cancelled");
  const questions = requests.data.filter((r) => r.kind === "question" && r.status === "open");
  const byStatus = (s: ReturnType<typeof requestStatus>[]) => docRequests.filter((r) => s.includes(requestStatus(r)));
  const needed = byStatus(["rejected", "needed"]).sort((a, b) => Number(requestStatus(b) === "rejected") - Number(requestStatus(a) === "rejected"));
  const waiting = byStatus(["uploaded"]);
  const accepted = byStatus(["accepted"]);
  const others = documents.data.filter((d) => !d.requestId);

  const total = docRequests.length;
  const summary = total
    ? `${accepted.length} of ${total} accepted · ${needed.length ? `${needed.length} still needed from you` : "nothing more needed from you"}`
    : "Everything your preparer asks for shows up here.";

  const row = (r: (typeof docRequests)[number]) => <RequestRow key={r.id} request={r} who={who(r.personId) ?? r.personName} engagementId={id!} preparer={preparer} files={filesFor(r.id)} />;

  return (
    <div className="grid grid-cols-1 content-start gap-8">
      <div className="grid gap-3">
        <PageHeader title="Documents" description={summary} />
        {total ? <Progress value={(accepted.length / total) * 100} aria-label={`${accepted.length} of ${total} documents accepted`} className="[&>[data-slot=progress-indicator]]:bg-success" /> : null}
      </div>

      {needed.length || questions.length ? (
        <>
          {needed.length ? (
            <section className="grid gap-3">
              <SectionHeader title="Needed" description={`${preparer} asked for these. Photos are fine: lay the page flat in good light with all four corners showing.`} />
              <List label="Needed">{needed.map(row)}</List>
            </section>
          ) : null}
          {questions.length ? (
            <section className="grid gap-3">
              <SectionHeader title={`${preparer} has a question`} description="A sentence or two is plenty." />
              <List label="Questions">
                {questions.map((q) => (
                  <QuestionCard key={q.id} request={q} preparer={preparer} />
                ))}
              </List>
            </section>
          ) : null}
        </>
      ) : (
        <EmptyState icon={FolderCheck} title="Nothing to upload right now" description={`When ${preparer} needs a document from you, it'll show up here.`} />
      )}

      {waiting.length ? (
        <section className="grid gap-3">
          <SectionHeader title="Uploaded" description={`Waiting for ${preparer} to check them.`} />
          <List label="Uploaded">{waiting.map(row)}</List>
        </section>
      ) : null}

      <section className="grid gap-3">
        <SectionHeader title="Something else to send?" description="A letter from the IRS, a form you think matters: send it and it goes with your return." />
        {publicDemo ? (
          <Banner tone="info" title="Uploads are off in the public demo" action={id ? <SampleButton fields={{ engagementId: id }} label="Send a sample" /> : null}>
            So nothing real can be sent here. A sample has invented details and goes through exactly the same steps.
          </Banner>
        ) : (
          <FileDropzone label="Upload something else" onFiles={extra.start} disabled={!id} />
        )}
        <UploadList items={extra.items.filter((i) => i.status !== "uploaded")} announcement={extra.announcement} onRetry={extra.retry} onRemove={extra.remove} />
        {others.length ? (
          <List label="Other things you sent">
            {others.map((d) => (
              <DocRow
                key={d.id}
                title={d.kindLabel === "Other document" ? d.filename : d.kindLabel}
                meta={who(d.personId) ? `For ${who(d.personId)}` : null}
                status={d.status}
                note={d.status === "rejected" ? <RejectedNote preparer={preparer} reason={d.rejectReason} /> : null}
              >
                <MyUpload doc={d} />
              </DocRow>
            ))}
          </List>
        ) : null}
      </section>

      {accepted.length ? (
        <section className="grid gap-3">
          <SectionHeader title="Accepted" description="All set. Nothing more to do for these." />
          <List label="Accepted">{accepted.map(row)}</List>
        </section>
      ) : null}
    </div>
  );
}
