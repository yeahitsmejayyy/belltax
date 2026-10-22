import type { Stage } from "@app/schema";
import { CircleDashed, MessageCircleQuestion, PencilLine } from "lucide-react";

import type { Need } from "@app/ui/components/client-home";
import { DOCUMENT_STATUS } from "@app/ui/components/status-chip";

import type { RouterOutputs } from "@/lib/trpc";

// What's waiting on the client, for Home's "N things need you" (NeedsCard in packages/ui, ticket 56): every open
// request, an unsigned letter and unfinished questions, each pointing at the screen that settles it. The rule lives
// here because it reads the API's shapes; the card that shows it is the design system's.

type Request = RouterOutputs["request"]["list"][number];
type Intake = RouterOutputs["intake"]["get"];
type Letter = RouterOutputs["letter"]["get"];

export function needsFor({ stage, requests, letter, intake }: { stage: Stage; requests: Request[]; letter: Letter; intake: Intake }): Need[] {
  const open = requests.filter((r) => r.status === "open");
  const docs = open.filter((r) => r.kind === "document");
  const docState = (r: Request) => (r.latestDocument?.status === "rejected" ? "rejected" : r.latestDocument?.status === "uploaded" ? "uploaded" : "needed");
  const doc = (r: Request): Need => ({ key: r.id, title: r.title, to: "/documents", cta: "Upload documents", chip: DOCUMENT_STATUS[docState(r)] });

  const needs: Need[] = [];
  const intakeOpen = intake ? !intake.submittedAt : stage === "invited" || stage === "intake";
  if (intakeOpen) {
    const started = intake && Object.keys(intake.answers).length > 0;
    needs.push({
      key: "intake",
      title: "Answer your questions",
      to: "/questions",
      cta: "Answer your questions",
      chip: started ? { tone: "neutral", icon: PencilLine, label: "Not finished" } : { tone: "neutral", icon: CircleDashed, label: "Not started" },
    });
  }
  needs.push(...docs.filter((r) => docState(r) === "rejected").map(doc));
  needs.push(...docs.filter((r) => docState(r) === "needed").map(doc));
  for (const q of open.filter((r) => r.kind === "question")) {
    needs.push({ key: q.id, title: q.title, to: "/documents", cta: "Answer the question", chip: { tone: "neutral", icon: MessageCircleQuestion, label: "Needs an answer" } });
  }
  if (letter?.canSign) {
    needs.push({ key: "letter", title: "Sign your engagement letter", to: "/letter", cta: "Sign your letter", chip: { tone: "neutral", icon: CircleDashed, label: "Not signed" } });
  }
  // Sent and waiting for the preparer's look isn't waiting on the client, so it isn't counted here; the
  // Documents screen shows it under Uploaded.
  return needs;
}
