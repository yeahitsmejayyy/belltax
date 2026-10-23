import type { FabItem } from "@app/ui/components/floating-action-menu";
import type { CheckedPoint, IconCardItem, MarketingLink } from "@app/ui/components/marketing";
import type { AccordionItem } from "@app/ui/components/site-faq";
import type { PackageCardLabels } from "@app/ui/components/site-pricing";
import {
  ArrowRight, Camera, CircleQuestionMark, CreditCard, Folder, House, ListChecks, Lock, MonitorPlay, PenLine, ReceiptText,
} from "lucide-react";

// The landing page's words (marketing 01-16), as data for the design system's site components. Practice details
// (city, state, reply-to) come in as arguments from useNames(); prices never live here (they're read from the portal).
// The copy speaks as the brand and pairs clients with "your tax agent": it never names the preparer.

const nb = " "; // keeps the last two words of a heading together

// ---------- Header and footer ----------

export const HOME: MarketingLink = { label: "belltax., back to top", href: "#main" };
export const SKIP = "Skip to content";

export const NAV: MarketingLink[] = [
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

/** The portal's sign-in is the hosted demo's front door (ticket 45). Back to "Sign in" when the practice goes live. */
export const DEMO_LABEL = "See the demo";
export const START_LABEL = "Get started";

/** The phone menu: the two actions, then the sections. `go` is what selecting one does. */
export function menuItems({ start, demo, go }: { start: string; demo: string; go: (href: string) => () => void }): FabItem[] {
  return [
    { label: START_LABEL, icon: ArrowRight, onSelect: go(start) },
    { label: DEMO_LABEL, icon: MonitorPlay, onSelect: go(demo) },
    { label: "How it works", icon: ListChecks, onSelect: go("#how") },
    { label: "Features", icon: House, onSelect: go("#features") },
    { label: "Pricing", icon: ReceiptText, onSelect: go("#pricing") },
    { label: "FAQ", icon: CircleQuestionMark, onSelect: go("#faq") },
  ];
}

export function footerLinks({ signIn, email }: { signIn: string; email: string | null }): MarketingLink[] {
  return [{ label: "Client sign in", href: signIn }, { label: "FAQ", href: "#faq" }, ...(email ? [{ label: email, href: `mailto:${email}` }] : [])];
}

// ---------- Hero ----------

/** What the hero and the splash list under the promise. IHSS only where it applies (California). */
export const sellingPoints = (region: string | null) => ["Flat, up-front pricing", `Federal and ${region ?? "state"} e-file`, ...(region === "California" ? ["IHSS caregivers welcome"] : [])];

export function heroCopy({ city, region, year }: { city: string | null; region: string | null; year: number }) {
  const where = city ? `Tax preparation in ${city}` : "Tax preparation";
  return {
    eyebrow: `${where} · Now booking for the ${year} tax${nb}year`,
    title: "Taxes Made Easy.",
    lead: `Federal and ${region ?? "state"} returns, prepared and e-filed by your personal tax agent. Share your documents, sign and pay, all from your phone, and follow every${nb}step.`,
    secondary: { label: "See how it works", href: "#how" },
    // The credential, stated the way California states it: CTEC-registered (not "licensed"), bonded, with a PTIN.
    credential: region === "California" ? "CTEC-registered · Bonded · IRS PTIN" : undefined,
  };
}

// ---------- Problem, solution, features ----------

export const PROBLEM = {
  eyebrow: "The problem",
  title: `Getting your taxes done shouldn’t feel like a second${nb}job`,
  lead: `Most people aren’t confused by their taxes. They’re worn out by everything around${nb}them.`,
  items: [
    { icon: Folder, title: "Paperwork everywhere", body: "Forms arrive by mail, email and apps. Gathering it all, then driving it to an office, eats a whole afternoon." },
    { icon: CircleQuestionMark, title: "No idea what’s happening", body: "Once you hand things over, it goes quiet. Is it filed? Are they waiting on you? You end up calling to ask." },
    { icon: ReceiptText, title: "A bill you didn’t expect", body: "The price shows up at the end, after the work is done, and it’s rarely the number you had in mind." },
  ] satisfies IconCardItem[],
};

export function solutionCopy({ brand, Agent }: { brand: string; Agent: string }) {
  return {
    eyebrow: "The solution",
    title: `Your personal tax agent, and one place to see${nb}it${nb}all`,
    lead: `${brand} pairs you with a personal tax agent who prepares your return, and your private portal shows you exactly where it${nb}stands. All from your${nb}phone.`,
    points: [
      { title: "A real tax agent, every time", body: `${Agent} prepares your return from start to finish. No hand-offs, no call center.` },
      { title: "Status you can see", body: "Your portal shows each stage, from intake to filed, and anything waiting on you." },
      { title: "The price before the work", body: "Flat pricing by filing status. Your invoice is in the portal before anything is filed." },
    ] satisfies CheckedPoint[],
    // The screenshot is the portal home drawn in HTML with invented data, read out as a single image.
    figureLabel: "A sample client portal home: four things the client still needs to do, an invoice, and the return at step 3 of 8, Documents.",
  };
}

export const FEATURES = {
  eyebrow: "Features",
  title: `Built for people with busy${nb}lives`,
  items: [
    { icon: Camera, title: "Upload from your phone", body: "Take a photo of each form. If a picture is hard to read, you’ll hear why and can retake it." },
    { icon: ListChecks, title: "Plain questions", body: "Short steps about your household, income and year. Save and come back any time." },
    { icon: House, title: "Always know what’s next", body: "A clear timeline and a short list of what’s waiting on you. Nothing else." },
    { icon: PenLine, title: "Sign online", body: "Read your engagement letter and sign by typing your name. Done in under a minute." },
    { icon: CreditCard, title: "Pay online", body: "Pay by card when your return is ready. If a payment doesn’t go through, retrying is easy." },
    { icon: Lock, title: "Private by default", body: "Your documents live in your portal, not an inbox. Sensitive numbers are always masked." },
  ] satisfies IconCardItem[],
};

// ---------- Pricing ----------

export type FilingStatus = "single" | "mfj" | "hoh";

export const PRICING = {
  eyebrow: "Pricing",
  title: "One flat price, known up front",
  lead: "Every price includes your federal and California returns and e-filing both. You see the invoice before anything is filed, and you pay online.",
  unavailable: "Prices load from our client portal; it’s not answering right now.",
  labels: { unit: "per return", unavailable: "Price shown when the portal answers", action: "Get started" } satisfies PackageCardLabels,
  featuredBadge: "Most families",
  // The design's three cards. Names and descriptions are fallbacks until the portal's own arrive.
  cards: [
    { status: "single", name: "Single", description: "One person, no dependents", items: ["Federal and California returns", "E-file for both", "W-2 and IHSS income", "Your own portal"] },
    { status: "mfj", name: "Married filing jointly", description: "Two spouses on one return", featured: true, items: ["Federal and California returns", "E-file for both", "Dependents and child credits", "Both spouses’ W-2s and IHSS pay"] },
    { status: "hoh", name: "Head of household", description: "Unmarried, with a dependent", items: ["Federal and California returns", "E-file for both", "Dependents and child credits", "Your own portal"] },
  ] as { status: FilingStatus; name: string; description: string; items: string[]; featured?: boolean }[],
  addonsTitle: "Add-ons, only if they apply",
  included: "Included",
  addonsEmpty: "Some situations add a small, fixed charge, like side work or an extra state. They’re listed here when the portal answers.",
  separateTitle: "Married and filing separately?",
  separateLead: (amount: string | null) => (amount ? `Each spouse’s return is ${amount}.` : "Each spouse files their own return, priced per return."),
  separateBody: (Agent: string) => `${Agent} will tell you in plain words whether filing jointly or separately works out better for your household before you decide.`,
  // No checkout until Stripe (ticket 09): each card opens an email to the practice.
  startHref: (email: string | null, name: string) => (email ? `mailto:${email}?subject=${encodeURIComponent(`New client — ${name}`)}` : "#cta"),
};

// ---------- FAQ ----------

// The prototype's seven questions plus three honest ones about where documents live and who sees them.
export function faqItems(agent: string): AccordionItem[] {
  return [
    { id: "faq-in-person", title: "Do I need to come in person?", body: `No. Everything happens in your portal: questions, documents, signing and payment. If you’d rather talk something through, ${agent} is a phone call or email away.` },
    { id: "faq-documents", title: "What documents will I need?", body: "Usually your W-2s, any 1099s, IHSS paystubs if you’re a home care provider, last year’s return, and a photo ID. After you answer the intake questions, the portal lists exactly what’s needed for your situation." },
    { id: "faq-ihss", title: "I’m an IHSS caregiver. Can you help?", body: `Yes. IHSS income comes up often, and there’s no extra charge to include it. If you care for a family member, ${agent} will walk you through how that pay is reported.` },
    { id: "faq-cost", title: "How much will it cost, and when do I pay?", body: "Your price is the flat package for your filing status, plus any add-ons that apply. You see the invoice in your portal before your return is filed, and you pay online by card." },
    { id: "faq-time", title: "How long does it take?", body: "Most returns are ready within a week or two of receiving all your documents. The portal shows each step, so you never have to wonder." },
    { id: "faq-safe", title: "Is my information safe?", body: "Your documents go straight to your private portal, not through email. Your Social Security and bank numbers are always shown masked, even to you." },
    { id: "faq-stored", title: "Where are my documents stored?", body: `In our own secure system, not a shared cloud drive. Storage is encrypted, and backups are encrypted before they’re saved. Uploads are deleted two years after your return is complete.` },
    { id: "faq-who-sees", title: "Who can see my documents?", body: `You, anyone on the same return as you (like a spouse filing jointly), and ${agent}. Nobody else has an account that can open them.` },
    { id: "faq-share", title: "Do you sell or share my information?", body: "No. It’s used to prepare and file your return, and it goes to the IRS and California’s Franchise Tax Board only when your return is filed. It is never sold." },
    { id: "faq-letter", title: "What if I get a letter from the IRS later?", body: `Send it through the portal or by email. ${agent.charAt(0).toUpperCase() + agent.slice(1)} prepared your return, so you’ll hear in plain words what it means and what to do next.` },
  ];
}

export const FAQ = { eyebrow: "Questions", title: "Frequently asked questions", defaultOpen: "faq-in-person" };

// ---------- Call to action ----------

export const CTA = {
  title: "Hand off your taxes this year",
  lead: `Start with a few questions. Your personal tax agent will reach out within one business day with your invite to the${nb}portal.`,
};
