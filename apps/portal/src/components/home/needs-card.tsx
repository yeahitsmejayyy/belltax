import type { Stage } from "@app/schema";
import { ChevronRight, CircleDashed, Coffee, MessageCircleQuestion, PencilLine } from "lucide-react";
import type * as React from "react";
import { Link } from "react-router-dom";

import { Button } from "@app/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { DOCUMENT_STATUS, StatusChip } from "@app/ui/components/status-chip";

import type { RouterOutputs } from "@/lib/trpc";

// "N things need you" (portal 05-home, desktop 22): every open request, an unsigned letter and unfinished
// questions, each a link to the screen that settles it, and one button for the first.

type Request = RouterOutputs["request"]["list"][number];
type Intake = RouterOutputs["intake"]["get"];
type Letter = RouterOutputs["letter"]["get"];

export type Need = { key: string; title: string; to: string; cta: string; chip: Pick<React.ComponentProps<typeof StatusChip>, "tone" | "icon" | "label"> };

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

const NEXT: Record<Stage, (p: string) => string> = {
  invited: (p) => `${p} will send your questions soon.`,
  intake: (p) => `${p} is looking over your answers and will ask for anything else needed.`,
  documents: (p) => `${p} is checking what you sent. You'll hear if anything else is needed.`,
  ready: (p) => `You're all set. ${p} will start your return soon.`,
  preparing: (p) => `${p} is working on your return. You'll be asked to review it when it's ready.`,
  review: (p) => `${p} will go over your return with you before it's filed.`,
  filed: () => "Your return was sent to the IRS and the state. We'll let you know when they accept it.",
  complete: () => "Your return was accepted. You're done for this year.",
};

export function NeedsCard({ needs, stage, preparer }: { needs: Need[]; stage: Stage; preparer: string }) {
  if (!needs.length) {
    return (
      <Card>
        <CardContent className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
            <Coffee aria-hidden="true" className="size-5" />
          </span>
          <div className="grid gap-1">
            <h2 className="font-semibold">Nothing needs you right now</h2>
            <p className="text-sm text-muted-foreground">{NEXT[stage](preparer)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const first = needs[0]!;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          <h2>{needs.length === 1 ? "1 thing needs you" : `${needs.length} things need you`}</h2>
        </CardTitle>
        <CardDescription>Start with the first one. {preparer} is notified as each is done.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="divide-y overflow-hidden rounded-lg border">
          {needs.map((n) => (
            <li key={n.key}>
              <Link
                to={n.to}
                className="flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <span className="grid min-w-0 flex-1 gap-1.5">
                  <span className="font-medium break-words">{n.title}</span>
                  <StatusChip {...n.chip} />
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
        <Button asChild size="touch" className="w-full">
          <Link to={first.to}>{first.cta}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
