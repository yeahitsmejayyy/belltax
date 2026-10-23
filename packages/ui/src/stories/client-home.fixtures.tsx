import { CircleDashed } from "lucide-react";

import type { Need } from "../components/client-home";
import { DOCUMENT_STATUS } from "../components/status-chip";

// Home's pieces with an invented household (ticket 57): what needs the client, as the portal builds it (lib/needs.ts).
export const HOME_NEEDS: Need[] = [
  { key: "w2", title: "Upload your W2 · Lakeside Community College", to: "/documents", cta: "Upload documents", chip: DOCUMENT_STATUS.rejected },
  { key: "childcare", title: "Upload your childcare receipt", to: "/documents", cta: "Upload documents", chip: DOCUMENT_STATUS.needed },
  { key: "letter", title: "Sign your engagement letter", to: "/letter", cta: "Sign your letter", chip: { tone: "neutral", icon: CircleDashed, label: "Not signed" } },
];

export const HOME_REACHED = [
  { stage: "invited" as const, at: "2026-10-04T17:00:00.000Z" },
  { stage: "intake" as const, at: "2026-10-09T17:00:00.000Z" },
  { stage: "documents" as const, at: "2026-10-12T17:00:00.000Z" },
];

// Story links go nowhere: the stories show the card, the app passes its router's link.
export const storyLink = (to: string, children: React.ReactNode, className?: string) => (
  <a href={`#${to}`} className={className} onClick={(e) => e.preventDefault()}>
    {children}
  </a>
);
