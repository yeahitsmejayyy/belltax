import type { WalkthroughCopy, WalkthroughPortal, WalkthroughStep } from "@app/ui/components/walkthrough";
import { ClipboardList, CreditCard, Folder, House, PenLine } from "lucide-react";

// "How it works": the script the phone plays (the prototype's demo script, Marketing Site.html), the section's words,
// and everything on the mini portal screens. The client is invented (docs/two-data-worlds.md): the phone never shows
// real data. WalkthroughSection (packages/ui) plays it.

type Names = { brand: string; agent: string; Agent: string };

const CLIENT = {
  first: "Jordan",
  full: "Jordan A. Example",
  initials: "JE",
  email: "jordan@example.com",
  taxYear: 2025,
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function walkthroughSteps(agent: string): WalkthroughStep[] {
  return [
    {
      title: "Accept your invite",
      body: `${cap(agent)} sends you a private link. Set a password and you’re in.`,
      shows: "The phone opens the invite, taps Set up my account, fills in a password and taps Create account.",
      beats: [
        { view: { screen: "invite" }, ms: 1300, tap: "setup" },
        { view: { screen: "password", filled: false }, ms: 700 },
        { view: { screen: "password", filled: true }, ms: 900, tap: "create" },
        { view: { screen: "password", filled: true, pending: true }, ms: 1600 },
      ],
    },
    {
      title: "See where things stand",
      body: "One timeline shows what’s done, what’s next, and what’s waiting on you.",
      shows: "The phone shows the home screen: the return’s stage and four things waiting on the client.",
      beats: [
        { view: { screen: "home" }, ms: 2600, tap: "tab-documents" },
        { view: { screen: "documents", upload: "idle" }, ms: 900 },
      ],
    },
    {
      title: "Snap photos of your forms",
      body: "W-2s, 1099s, IHSS paystubs. Take a photo or pick a file.",
      shows: "The phone taps Take a photo on the documents screen and the 1099 uploads.",
      beats: [
        { view: { screen: "documents", upload: "idle" }, ms: 1300, tap: "photo" },
        { view: { screen: "documents", upload: "uploading" }, ms: 1400 },
        { view: { screen: "documents", upload: "done" }, ms: 2000 },
      ],
    },
    {
      title: "Sign your agreement",
      body: "Read the engagement letter, type your name, and sign in seconds.",
      shows: "The phone shows the engagement letter with the client’s typed name, taps Sign letter, and it’s signed.",
      beats: [
        { view: { screen: "letter", signed: false }, ms: 1300, tap: "sign" },
        { view: { screen: "letter", signed: true }, ms: 2600 },
      ],
    },
    {
      title: "Pay and get your receipt",
      body: "Pay online when your return is ready. Your receipt is saved in the portal.",
      shows: "The phone shows a $285 invoice, taps Pay, the invoice turns Paid, and the receipt is downloaded.",
      beats: [
        { view: { screen: "invoice", paid: "no" }, ms: 1300, tap: "pay" },
        { view: { screen: "invoice", paid: "processing" }, ms: 1200 },
        { view: { screen: "invoice", paid: "yes" }, ms: 1800, tap: "receipt" },
        { view: { screen: "invoice", paid: "yes", saved: true }, ms: 2200 },
      ],
    },
  ];
}

export const WALKTHROUGH_COPY: WalkthroughCopy = {
  eyebrow: "How it works",
  title: "Five steps, all from your phone",
  intro: "This is the portal, with sample data. Watch it play, or pick a step.",
  previous: "Previous step",
  next: "Next step",
  play: "Play",
  pause: "Pause",
  caption: ({ step, of, title }) => `Step ${step} of ${of} · ${title}`,
  announce: ({ step, of, title, shows }) => `Step ${step} of ${of}: ${title}. ${shows}`,
};

export function walkthroughPortal({ brand, agent, Agent }: Names): WalkthroughPortal {
  const needs = [
    { title: "IHSS paystubs, January to December", status: "rejected" as const },
    { title: "1099-NEC from Example Rides Co.", status: "needed" as const },
    { title: `Photo ID for ${CLIENT.first}`, status: "needed" as const },
    { title: "Sign your engagement letter", status: "unsigned" as const },
  ];
  const total = 28500;
  return {
    shell: {
      mode: "Demo",
      initials: CLIENT.initials,
      tabs: [
        { key: "home", label: "Home", icon: House },
        { key: "questions", label: "Questions", icon: ClipboardList },
        { key: "documents", label: "Documents", icon: Folder },
        { key: "letter", label: "Letter", icon: PenLine },
        { key: "invoice", label: "Invoice", icon: CreditCard },
      ],
    },
    invite: {
      from: `Invitation from ${brand}`,
      title: `${Agent} invited you to set up your account`,
      intro: "This is where you'll answer a few questions, upload your tax documents, and see where your return stands.",
      emailLabel: "Your account email",
      email: CLIENT.email,
      action: "Set up my account",
      note: `Your documents are encrypted and only ${agent} can see them. This invite link works once and expires in 7 days.`,
    },
    password: {
      title: "Create a password",
      intro: ["You'll use it with ", " to sign in."],
      email: CLIENT.email,
      fields: ["Password", "Type it again"],
      dots: "••••••••••••••",
      rules: ["At least 12 characters", "Not your email address", "Both passwords match"],
      action: "Create account",
      pending: "Creating your account…",
    },
    home: {
      badges: { documents: 3, letter: 1 },
      greeting: `Hi, ${CLIENT.first}`,
      returnLine: `Your ${CLIENT.taxYear} tax return · prepared by ${agent}`,
      stage: "documents",
      stepLabel: "Step 3 of 8",
      progress: 33,
      needsTitle: `${needs.length} things need you`,
      needsHint: `Start with the first one. ${Agent} is notified as each is done.`,
      unsigned: "Not signed",
      needs,
      action: "Upload documents",
    },
    documents: {
      title: "Documents",
      summary: { before: "1 of 5 accepted · 3 still needed from you", after: "1 of 5 accepted · 2 still needed from you" },
      badges: { before: { documents: 3, letter: 1 }, after: { documents: 2, letter: 1 } },
      progress: 20,
      toast: `Uploaded. ${Agent} will check it.`,
      takePhoto: "Take a photo",
      chooseFile: "Choose a file",
      uploading: "Uploading 1099-NEC photo…",
      uploadProgress: 64,
      tip: "Photos are fine. Lay the page flat in good light with all four corners showing.",
      askedFor: `${Agent} asked for`,
      requests: [
        { title: "W-2 from Pinecone Bakery LLC", detail: "Your job · 2025", status: "accepted" },
        { title: "1099-NEC from Example Rides Co.", detail: "Side work · 2025", status: "needed" },
        { title: `Photo ID for ${CLIENT.first}`, detail: "Front side is enough", status: "needed" },
      ],
      uploads: 1,
    },
    letter: {
      badges: { unsigned: { documents: 3, letter: 1 }, signed: { documents: 3, letter: 0 } },
      toast: "Letter signed",
      title: "Engagement letter",
      intro: `This explains what ${agent} will do for you and what it costs. Read it, then sign below.`,
      heading: `Tax year ${CLIENT.taxYear} engagement letter`,
      between: `Between ${brand} and ${CLIENT.full}.`,
      sectionTitle: "What I'll do",
      section: `Prepare your ${CLIENT.taxYear} federal and California income tax returns from the information and documents you give me, and e-file them once you approve.`,
      signedTitle: `Signed by ${CLIENT.full}`,
      signedNote: "Signed today. A copy is saved in your documents.",
      nameLabel: "Type your full legal name",
      name: CLIENT.full,
      consent: "I've read this letter, I agree to it, and I agree to sign electronically.",
      action: "Sign letter",
    },
    invoice: {
      badges: { documents: 3 },
      toast: "Receipt downloaded",
      title: "Invoice",
      meta: "Invoice BTP-2025-0142 · Sent March 10, 2026",
      total,
      due: "Due before filing",
      coversLabel: "What it covers",
      lines: [
        { label: "Federal return (Form 1040) with IHSS income", cents: 19000 },
        { label: "California return (Form 540)", cents: 7000 },
        { label: "E-file, federal and state", cents: 2500 },
      ],
      totalLabel: "Total",
      paidNote: "Paid March 12, 2026 at 6:18 PM with Visa ••••4242. Receipt #R-20260312-0142.",
      receipt: "Download receipt",
      pay: "Pay",
      processing: "Opening secure checkout…",
      note: `You'll pay on Stripe's secure checkout page. ${brand} never sees your card number.`,
    },
  };
}
