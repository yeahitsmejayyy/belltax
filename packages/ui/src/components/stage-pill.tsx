import type { Stage } from "@app/schema";
import { CheckCircle2, ClipboardList, Eye, Folder, ListChecks, Mail, PenLine, Send, type LucideIcon } from "lucide-react";
import type * as React from "react";

import { StatusChip } from "./status-chip";
import type { Tone } from "./tone";

// A return's stage: icon + label + tone (principles.md rule 6). The tone says who it's waiting on.
// Reference: .assets/screens/admin/desktop/03-dashboard-dashboard.png ("Returns by stage").

export type Waiting = "client" | "preparer" | "authority" | "done";

export const STAGE_META: Record<Stage, { label: string; icon: LucideIcon; waiting: Waiting }> = {
  invited: { label: "Invited", icon: Mail, waiting: "client" },
  intake: { label: "Intake", icon: ClipboardList, waiting: "client" },
  documents: { label: "Documents", icon: Folder, waiting: "client" },
  ready: { label: "Ready to prep", icon: ListChecks, waiting: "preparer" },
  preparing: { label: "Preparing", icon: PenLine, waiting: "preparer" },
  review: { label: "Client review", icon: Eye, waiting: "client" },
  filed: { label: "Filed", icon: Send, waiting: "authority" },
  complete: { label: "Complete", icon: CheckCircle2, waiting: "done" },
};

export const WAITING_TONE: Record<Waiting, Tone> = { client: "neutral", preparer: "brand", authority: "info", done: "success" };
export const WAITING_LABEL: Record<Waiting, string> = {
  client: "Waiting on client",
  preparer: "Waiting on you",
  authority: "Waiting on IRS and FTB",
  done: "Done",
};

export function StagePill({ stage, ...props }: { stage: Stage } & React.ComponentProps<"span">) {
  const m = STAGE_META[stage];
  return <StatusChip data-stage={stage} tone={WAITING_TONE[m.waiting]} icon={m.icon} label={m.label} title={WAITING_LABEL[m.waiting]} {...props} />;
}
