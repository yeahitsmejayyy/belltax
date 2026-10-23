import { Camera, CircleQuestionMark, CreditCard, Folder, House, ListChecks, Lock, PenLine, ReceiptText } from "lucide-react";

import type { CheckedPoint, IconCardItem, MarketingLink } from "../components/marketing";
import type { MockTodo, PortalMockup } from "../components/portal-mockups";
import type { AccordionItem } from "../components/site-faq";
import type { AddonLine, PackageCardLabels } from "../components/site-pricing";

// Invented copy and data for the Site component stories (ticket 60). The practice is Bell Tax, the preparer is always
// "your tax agent", and every price is a SAMPLE: the real site reads its prices from the portal and never copies them.
// Nothing here is real (docs/two-data-worlds.md).

export const BRAND = "belltax.";
export const AGENT = "your tax agent";
export const Agent = "Your tax agent";
export const PLACE = "Los Angeles, CA";
export const EMAIL = "hello@belltax.example";
export const START = `mailto:${EMAIL}?subject=New%20client`;

export const NAV: MarketingLink[] = [
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export const POINTS = ["Flat, up-front pricing", "Federal and California e-file", "IHSS caregivers welcome"];

export const PROBLEMS: IconCardItem[] = [
  { icon: Folder, title: "Paperwork everywhere", body: "Forms arrive by mail, email and apps. Gathering it all eats a whole afternoon." },
  { icon: CircleQuestionMark, title: "No idea what’s happening", body: "Once you hand things over, it goes quiet. You end up calling to ask." },
  { icon: ReceiptText, title: "A bill you didn’t expect", body: "The price shows up at the end, after the work is done." },
];

export const FEATURES: IconCardItem[] = [
  { icon: Camera, title: "Upload from your phone", body: "Take a photo of each form. If it’s hard to read, you’ll hear why." },
  { icon: ListChecks, title: "Plain questions", body: "Short steps about your household, income and year." },
  { icon: House, title: "Always know what’s next", body: "A clear timeline and a short list of what’s waiting on you." },
  { icon: PenLine, title: "Sign online", body: "Read your engagement letter and sign by typing your name." },
  { icon: CreditCard, title: "Pay online", body: "Pay by card when your return is ready." },
  { icon: Lock, title: "Private by default", body: "Your documents live in your portal, not an inbox." },
];

export const SOLUTION_POINTS: CheckedPoint[] = [
  { title: "A real tax agent, every time", body: `${Agent} prepares your return from start to finish.` },
  { title: "Status you can see", body: "Your portal shows each stage, from intake to filed." },
  { title: "The price before the work", body: "Your invoice is in the portal before anything is filed." },
];

// ---------- Pricing (SAMPLE prices) ----------

export const CARD_LABELS: PackageCardLabels = { unit: "per return", unavailable: "Price shown when the portal answers", action: "Get started" };

export const PACKAGES = [
  { key: "single", name: "Single", description: "One person, no dependents", amount: "$199", items: ["Federal and California returns", "E-file for both", "Your own portal"] },
  { key: "mfj", name: "Married filing jointly", description: "Two spouses on one return", amount: "$299", badge: "Most families", items: ["Federal and California returns", "E-file for both", "Dependents and child credits"] },
  { key: "hoh", name: "Head of household", description: "Unmarried, with a dependent", amount: "$249", items: ["Federal and California returns", "E-file for both", "Dependents and child credits"] },
];

export const ADDONS: AddonLine[] = [
  { key: "self_employment", name: "Side work or gig income", description: "Schedule C (sample price)", price: "+$75" },
  { key: "ihss", name: "IHSS home care income", description: "Paystub review", price: "Included" },
  { key: "other_state", name: "Each additional state", description: null, price: "+$50" },
];

export const ADDONS_EMPTY = "Some situations add a small, fixed charge. They’re listed here when the portal answers.";
export const SEPARATE_BODY = `${Agent} will tell you in plain words whether filing jointly or separately works out better.`;

// ---------- FAQ ----------

export const FAQ: AccordionItem[] = [
  { id: "faq-in-person", title: "Do I need to come in person?", body: `No. Everything happens in your portal. ${Agent} is a phone call or email away.` },
  { id: "faq-cost", title: "How much will it cost, and when do I pay?", body: "A flat package for your filing status, plus any add-ons that apply. You pay online once the invoice is in your portal." },
  { id: "faq-time", title: "How long does it take?", body: "Most returns are ready within a week or two of receiving all your documents." },
];

// ---------- The portal pictures (invented household) ----------

const TODO: MockTodo[] = [
  { title: "Paystubs, January to December", status: "rejected" },
  { title: "1099-NEC from Example Rides Co.", status: "needed" },
  { title: "Photo ID for Jordan", status: "needed" },
  { title: "Sign your engagement letter", status: "unsigned" },
];

export const PORTAL_SAMPLE: PortalMockup = {
  mode: "Demo",
  initials: "JE",
  greeting: "Hi, Jordan",
  returnLine: `Your 2025 tax return · prepared by ${AGENT}`,
  needs: { title: `${TODO.length} things need you`, hint: `Start with the first one. ${Agent} is notified as each is done.`, unsigned: "Not signed", rows: TODO },
  documents: {
    title: "Documents",
    summary: "1 of 5 accepted · 3 still needed from you",
    progress: 20,
    takePhoto: "Take a photo",
    chooseFile: "Choose a file",
    tip: "Photos are fine. Lay the page flat in good light.",
    rows: TODO.slice(1, 3),
  },
  letter: {
    title: "Letter signed",
    note: "Thanks. A copy is on its way to jordan@example.com.",
    details: [
      ["Signed by", "Jordan A. Example"],
      ["Signed", "Feb 12, 9:41 AM"],
      ["Letter", "Engagement letter"],
    ],
    back: "Back to home",
  },
  desktop: {
    mode: "Demo · sample data",
    nav: ["Home", "Questions", "Documents", "Letter", "Invoice"],
    current: "Home",
    invoice: { label: `Invoice from ${AGENT}`, cents: 28500, status: "Due before filing", action: "View invoice" },
    stage: { title: "Where your return stands", caption: "Step 3 of 8 · Documents", stage: "documents" },
  },
};
