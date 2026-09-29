import { FileText, Receipt, Settings, Users } from "lucide-react";

import type { SearchGroup } from "../components/command-search";
import type { InviteDraft } from "../components/invite-client-dialog";

// Invented data shared by the stories. Nothing here is real.

// "Fill sample data" in the invite dialog.
export const SAMPLE: Omit<InviteDraft, "mode"> = {
  surname: "Example",
  email: "m@example.com",
  phone: "(555) 010-0000",
  members: [
    { first: "Morgan", role: "primary" },
    { first: "Avery", role: "spouse" },
    { first: "Sky", role: "dependent" },
  ],
  filing: "mfj",
  filers: [0, 1],
};

// Clients, returns and invoices for search.
export const searchGroups = (go: (to: string) => void): SearchGroup[] => [
  {
    heading: "Clients",
    items: [
      { id: "h-marigold", label: "Dana & Sam Marigold", sublabel: "Married filing jointly · 2 returns", icon: Users, onSelect: () => go("client:marigold") },
      { id: "h-kestrel", label: "Sidney Kestrel", sublabel: "Head of household · 1 return", icon: Users, onSelect: () => go("client:kestrel") },
      { id: "h-wren", label: "Toni Wren", sublabel: "Single · 3 returns", icon: Users, onSelect: () => go("client:wren") },
    ],
  },
  {
    heading: "Returns",
    items: [
      { id: "r-marigold-2026", label: "Marigold · TY 2026", sublabel: "Preparing · 4 days", icon: FileText, keywords: ["dana", "sam"], hint: "Preparing", onSelect: () => go("return:marigold-2026") },
      { id: "r-wren-2026", label: "Wren · TY 2026", sublabel: "Documents · 12 days", icon: FileText, keywords: ["toni"], hint: "Documents", onSelect: () => go("return:wren-2026") },
    ],
  },
  {
    heading: "Invoices",
    items: [{ id: "i-2026-0014", label: "2026-0014 · $340.00", sublabel: "Marigold · payment failed", icon: Receipt, keywords: ["marigold"], onSelect: () => go("invoice:2026-0014") }],
  },
  {
    heading: "Go to",
    items: [{ id: "g-settings", label: "Settings", icon: Settings, onSelect: () => go("settings") }],
  },
];
