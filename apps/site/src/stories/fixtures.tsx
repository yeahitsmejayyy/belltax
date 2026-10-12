import type { Decorator } from "@storybook/react-vite";

import { PublicFixture, type Public } from "@/lib/public";

// Invented practice details and prices for the Site stories: what the portal's practice.public and pricing.public
// would return, so every section renders as on the page without a server. Nothing here is real.

export const PRACTICE: NonNullable<Public["practice"]> = {
  practiceName: "Bell Tax",
  preparerName: "Sample Preparer",
  preparerCredential: null,
  replyToEmail: "hello@belltax.example",
  city: "Los Angeles",
  state: "CA",
};

export const PRICING: NonNullable<Public["pricing"]> = {
  packages: [
    { code: "single", filingStatus: "single", name: "Single", description: "One filer · federal and California", unitAmountCents: 22500 },
    { code: "mfj", filingStatus: "mfj", name: "Married filing jointly", description: "Two filers, one return · federal and California", unitAmountCents: 34000 },
    { code: "mfs", filingStatus: "mfs", name: "Married filing separately", description: "Priced per return", unitAmountCents: 24500 },
    { code: "hoh", filingStatus: "hoh", name: "Head of household", description: "One filer with dependents · federal and California", unitAmountCents: 31000 },
  ],
  addons: [
    { code: "self_employment", name: "Side work or gig income", description: "Schedule C for 1099-NEC or app-based work", unitAmountCents: 8500 },
    { code: "ihss", name: "IHSS home care income", description: "Paystub review for IHSS caregivers", unitAmountCents: null },
    { code: "covered_california", name: "Covered California", description: "Form 1095-A and premium tax credit", unitAmountCents: 4000 },
    { code: "other_state", name: "Each additional state", description: "Part-year or nonresident state return", unitAmountCents: 6000 },
    { code: "rental", name: "Rental property", description: "Schedule E, per property", unitAmountCents: 12500 },
    { code: "investments", name: "Investments", description: "Schedule D for sales of stocks or funds", unitAmountCents: 7500 },
  ],
};

export const READY: Public = { practice: PRACTICE, pricing: PRICING, status: "ready" };
export const LOADING: Public = { practice: null, pricing: null, status: "loading" };
export const UNAVAILABLE: Public = { practice: null, pricing: null, status: "unavailable" };

// Wraps a story in the site's data. Stories pick a state with parameters.public (default: ready).
export const withPublic: Decorator = (Story, context) => (
  <PublicFixture value={(context.parameters.public as Public | undefined) ?? READY}>
    <Story />
  </PublicFixture>
);
