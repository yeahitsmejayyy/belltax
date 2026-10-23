import type { DocumentChipStatus } from "../components/status-chip";
import type { SentFileItem } from "../components/client-documents";

// Invented data for the portal Documents stories (ticket 56). Nothing here is real.

export const PREPARER = "Morgan";

export const SENT: SentFileItem[] = [
  { id: "doc-w2-page1", filename: "w2-lakeside-page1.jpg", sentAt: "2026-02-03T17:20:00.000Z", removable: true },
  { id: "doc-w2-page2", filename: "w2-lakeside-page2.jpg", sentAt: "2026-02-03T17:21:00.000Z", removable: true },
];

export const REVIEWED: SentFileItem = { id: "doc-1098", filename: "1098-mortgage-interest.pdf", sentAt: "2026-01-28T15:04:00.000Z", removable: false };

export type RequestFixture = { id: string; title: string; who: string | null; note: string | null; status: DocumentChipStatus; rejectReason?: string | null; open: boolean; files: SentFileItem[] };

export const REQUESTS: Record<"needed" | "rejected" | "uploaded" | "accepted", RequestFixture> = {
  needed: { id: "req-childcare", title: "Upload your childcare receipt", who: "you", note: "Sunny Days Learning Center, all of 2026", status: "needed", open: true, files: [] },
  rejected: {
    id: "req-w2",
    title: "Upload your W-2 · Lakeside Community College",
    who: "Avery",
    note: null,
    status: "rejected",
    rejectReason: "The bottom of the page is cut off. Please include boxes 15 to 20.",
    open: true,
    files: [],
  },
  uploaded: { id: "req-w2-dana", title: "Upload your W-2 · Harbor Freight Co-op", who: "you", note: null, status: "uploaded", open: true, files: SENT },
  accepted: { id: "req-1098", title: "Upload your 1098 · Example Mortgage", who: null, note: null, status: "accepted", open: false, files: [REVIEWED] },
};

export const QUESTIONS = [
  { id: "q-move", title: "Did you move to a new home in 2026?", note: "If so, the date you moved in is enough." },
  { id: "q-hsa", title: "Did anyone in the household have an HSA?", note: null },
];
