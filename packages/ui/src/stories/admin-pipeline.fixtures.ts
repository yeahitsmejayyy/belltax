import type { PipelineTableRow } from "../components/pipeline";

// The year's returns as the pipeline table and toolbar stories show them. Invented households.

export const ROWS: PipelineTableRow[] = [
  { id: "wren", household: "Toni Wren", filers: 1, filing: "Single", stage: "documents", daysInStage: 12, openRequests: 3, balanceCents: 0, efile: { federal: null, state: null } },
  { id: "birchwood", household: "Chris & Taylor Birchwood", filers: 2, filing: "MFJ", stage: "documents", daysInStage: 3, openRequests: 1, balanceCents: 0, efile: { federal: null, state: null } },
  { id: "marigold", household: "Dana & Sam Marigold", filers: 2, filing: "MFJ", stage: "preparing", daysInStage: 4, openRequests: 0, balanceCents: 34000, efile: { federal: null, state: null } },
  { id: "kestrel", household: "Sidney Kestrel", filers: 1, filing: "HOH", stage: "filed", daysInStage: 1, openRequests: 0, balanceCents: 0, efile: { federal: "accepted", state: "submitted" } },
  { id: "dovetail", household: "Remy Dovetail", filers: 1, filing: null, stage: "intake", daysInStage: 9, openRequests: 0, balanceCents: 22500, efile: { federal: null, state: null } },
  { id: "alder", household: "Jordan Alder", filers: 1, filing: "Single", stage: "filed", daysInStage: 2, openRequests: 0, balanceCents: 0, efile: { federal: "rejected", state: null } },
];
