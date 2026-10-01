import type { DocumentChipStatus } from "@app/ui/components/status-chip";

// The walkthrough's client. Every value is invented (docs/two-data-worlds.md): the phone never shows real data.

export const CLIENT = {
  first: "Jordan",
  full: "Jordan A. Example",
  initials: "JE",
  email: "jordan@example.com",
  taxYear: 2025,
};

export const NEEDS: { title: string; status: DocumentChipStatus | "unsigned" }[] = [
  { title: "IHSS paystubs, January to December", status: "rejected" },
  { title: "1099-NEC from Example Rides Co.", status: "needed" },
  { title: `Photo ID for ${CLIENT.first}`, status: "needed" },
  { title: "Sign your engagement letter", status: "unsigned" },
];

export const REQUESTS: { title: string; detail: string; status: DocumentChipStatus }[] = [
  { title: "W-2 from Pinecone Bakery LLC", detail: "Your job · 2025", status: "accepted" },
  { title: "1099-NEC from Example Rides Co.", detail: "Side work · 2025", status: "needed" },
  { title: `Photo ID for ${CLIENT.first}`, detail: "Front side is enough", status: "needed" },
];

export const INVOICE = {
  number: "BTP-2025-0142",
  sent: "March 10, 2026",
  lines: [
    { label: "Federal return (Form 1040) with IHSS income", cents: 19000 },
    { label: "California return (Form 540)", cents: 7000 },
    { label: "E-file, federal and state", cents: 2500 },
  ],
  total: 28500,
  paid: "Paid March 12, 2026 at 6:18 PM with Visa ••••4242. Receipt #R-20260312-0142.",
};
