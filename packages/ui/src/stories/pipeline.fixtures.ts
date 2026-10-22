import type { Stage } from "@app/schema";

import type { BoardCardData } from "../components/board";

// The cards, columns and move rule the Pipeline board stories use. The Docs page shows this file's source as its
// code blocks (ticket 56), so what you read there is exactly what the stories pass in. Invented households.

// --- Cards
// One per return: the column it's in (stage) and what its card shows.
export const cards: BoardCardData[] = [
  { id: "wren", stage: "documents", household: "Wren", filers: "Toni", filingStatus: "Single", missingDocuments: 3, daysInStage: 12 },
  { id: "birchwood", stage: "documents", household: "Birchwood", filers: "Chris & Taylor", filingStatus: "Married filing jointly", missingDocuments: 1, daysInStage: 3 },
  { id: "marigold", stage: "preparing", household: "Marigold", filers: "Dana & Sam", filingStatus: "Married filing jointly", unpaid: true, daysInStage: 4 },
  { id: "kestrel", stage: "filed", household: "Kestrel", filers: "Sidney", filingStatus: "Head of household", daysInStage: 1 },
];

// --- Columns
// Which stages to show, in order. Leave it out for all eight.
export const stages: Stage[] = ["documents", "ready", "preparing", "review", "filed"];

// --- Move rule
// Where a held card may land; the other columns fade. Here: forward one stage, or back to any earlier one.
export const canMove = (card: BoardCardData, to: Stage) => {
  const step = stages.indexOf(to) - stages.indexOf(card.stage);
  return step === 1 || step < 0;
};
