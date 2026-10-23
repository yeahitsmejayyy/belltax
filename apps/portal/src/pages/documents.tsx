import type { DocumentView, RequestView } from "@app/schema";
import { FolderCheck, FolderOpen } from "lucide-react";

import { DocRow, DocumentList, DocumentSection, DocumentsSummary, QuestionCard, RejectedNote, RequestRow, SendSomethingElse, SentFile, requestStatus, type UploadsState } from "@app/ui/components/client-documents";
import { EmptyState } from "@app/ui/components/empty-state";
import { Skeleton } from "@app/ui/components/skeleton";

import { useAnswerQuestion, useRemoveDocument, useSampleDocument } from "@/components/documents/use-documents";
import { useDocumentUploads } from "@/components/documents/use-upload";
import { useDemoTour } from "@/lib/demo-tour";
import { usePageTitle, useReturn } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// Documents (portal 13-documents, desktop 23-desktop-d-documents): what the preparer asked for, grouped by
// where it stands, an upload on every row, questions answered in place, and room for anything else. The screen is
// drawn by @app/ui/components/client-documents; this file fetches, maps API shapes to props and wires the actions.

type Uploads = ReturnType<typeof useDocumentUploads>;
const uploadsState = (u: Uploads): UploadsState => ({ items: u.items, announcement: u.announcement, onRetry: u.retry, onRemove: u.remove });

type Remover = ReturnType<typeof useRemoveDocument>;
const sentFile = (d: DocumentView, removing: Remover) => ({ id: d.id, filename: d.filename, sentAt: d.uploadedAt, removable: d.mine && d.status === "uploaded", pending: removing.isPending(d.id) });

// One request's row: its own uploads (or sample, in the public demo) and the files already sent for it.
function Request({ request, who, engagementId, preparer, files, removing, publicDemo }: { request: RequestView; who: string | null; engagementId: string; preparer: string; files: DocumentView[]; removing: Remover; publicDemo: boolean }) {
  const uploads = useDocumentUploads({ engagementId, requestId: request.id });
  const sample = useSampleDocument({ engagementId, requestId: request.id });
  const sent = files.filter((d) => d.status !== "rejected");
  return (
    <RequestRow
      title={request.title}
      who={who}
      note={request.note}
      status={requestStatus(request)}
      preparer={preparer}
      rejectReason={request.latestDocument?.rejectReason ?? null}
      open={request.status === "open"}
      files={sent.map((d) => sentFile(d, removing))}
      onRemoveFile={(docId) => {
        const d = sent.find((x) => x.id === docId);
        if (d) void removing.remove(d);
      }}
      uploads={uploadsState(uploads)}
      onFiles={uploads.start}
      sample={publicDemo ? sample : null}
    />
  );
}

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
  const extraSample = useSampleDocument({ engagementId: id ?? "" });
  const removing = useRemoveDocument();
  const preparer = practice?.preparerName.split(/\s+/)[0] ?? "Your preparer";
  const answers = useAnswerQuestion(preparer);

  if (!loading && !current) return <EmptyState icon={FolderOpen} title="No return yet" description="Once your preparer opens your return, what they need from you shows up here." />;
  if (!requests.data || !documents.data) return <Skeleton aria-label="Loading your documents" className="h-96 rounded-xl" />;

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

  const row = (r: (typeof docRequests)[number]) => (
    <Request key={r.id} request={r} who={who(r.personId) ?? r.personName} engagementId={id!} preparer={preparer} files={filesFor(r.id)} removing={removing} publicDemo={publicDemo} />
  );

  return (
    <div className="grid grid-cols-1 content-start gap-8">
      <DocumentsSummary accepted={accepted.length} needed={needed.length} total={docRequests.length} />

      {needed.length || questions.length ? (
        <>
          {needed.length ? (
            <DocumentSection title="Needed" description={`${preparer} asked for these. Photos are fine: lay the page flat in good light with all four corners showing.`}>
              <DocumentList label="Needed">{needed.map(row)}</DocumentList>
            </DocumentSection>
          ) : null}
          {questions.length ? (
            <DocumentSection title={`${preparer} has a question`} description="A sentence or two is plenty.">
              <DocumentList label="Questions">
                {questions.map((q) => (
                  <QuestionCard key={q.id} title={q.title} note={q.note} pending={answers.isPending(q.id)} onAnswer={(text) => answers.send(q.id, text)} />
                ))}
              </DocumentList>
            </DocumentSection>
          ) : null}
        </>
      ) : (
        <EmptyState icon={FolderCheck} title="Nothing to upload right now" description={`When ${preparer} needs a document from you, it'll show up here.`} />
      )}

      {waiting.length ? (
        <DocumentSection title="Uploaded" description={`Waiting for ${preparer} to check them.`}>
          <DocumentList label="Uploaded">{waiting.map(row)}</DocumentList>
        </DocumentSection>
      ) : null}

      <SendSomethingElse publicDemo={publicDemo} sample={id ? extraSample : null} onFiles={extra.start} disabled={!id} uploads={uploadsState(extra)}>
        {others.length ? (
          <DocumentList label="Other things you sent">
            {others.map((d) => (
              <DocRow
                key={d.id}
                title={d.kindLabel === "Other document" ? d.filename : d.kindLabel}
                meta={who(d.personId) ? `For ${who(d.personId)}` : null}
                status={d.status}
                note={d.status === "rejected" ? <RejectedNote preparer={preparer} reason={d.rejectReason} /> : null}
              >
                <SentFile {...sentFile(d, removing)} onRemove={() => void removing.remove(d)} />
              </DocRow>
            ))}
          </DocumentList>
        ) : null}
      </SendSomethingElse>

      {accepted.length ? (
        <DocumentSection title="Accepted" description="All set. Nothing more to do for these.">
          <DocumentList label="Accepted">{accepted.map(row)}</DocumentList>
        </DocumentSection>
      ) : null}
    </div>
  );
}
