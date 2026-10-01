// The five steps and what the phone does in each (the prototype's demo script, Marketing Site.html).
// A step is a list of beats: show a screen for `ms`, then, if there's a `tap`, tap that target (TAP_MS).

export type View =
  | { screen: "invite" }
  | { screen: "password"; filled: boolean; pending?: boolean }
  | { screen: "home" }
  | { screen: "documents"; upload: "idle" | "uploading" | "done" }
  | { screen: "letter"; signed: boolean }
  | { screen: "invoice"; paid: "no" | "processing" | "yes"; saved?: boolean };

// Elements in the screens carry `data-tap={target}` so the dot lands on them.
export type TapTarget = "setup" | "create" | "tab-documents" | "photo" | "sign" | "pay" | "receipt";

export type Beat = { view: View; ms: number; tap?: TapTarget };
export type Step = { title: string; body: string; shows: string; beats: Beat[] };

export const TAP_MS = 700;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildSteps(preparerFirst: string): Step[] {
  return [
    {
      title: "Accept your invite",
      body: `${cap(preparerFirst)} sends you a private link. Set a password and you’re in.`,
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

export const stepDuration = (s: Step) => s.beats.reduce((t, b) => t + b.ms + (b.tap ? TAP_MS : 0), 0);
