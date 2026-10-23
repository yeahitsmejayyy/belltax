import type { MockTodo, PortalMockup } from "@app/ui/components/portal-mockups";

// The sample the site's portal pictures show (hero phones, splash phones, the solution screenshot). Every value is
// invented (docs/two-data-worlds.md): "Jordan A. Example" is not a person.

const TODO: MockTodo[] = [
  { title: "Paystubs, January to December", status: "rejected" },
  { title: "1099-NEC from Example Rides Co.", status: "needed" },
  { title: "Photo ID for Jordan", status: "needed" },
  { title: "Sign your engagement letter", status: "unsigned" },
];

/** The portal mockups' data for one season: `year` is the tax year shown, `agent`/`Agent` what the copy calls the preparer. */
export function portalSample({ agent, Agent, year }: { agent: string; Agent: string; year: number }): PortalMockup {
  return {
    mode: "Demo",
    initials: "JE",
    greeting: "Hi, Jordan",
    returnLine: `Your ${year} tax return · prepared by ${agent}`,
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
      invoice: { label: `Invoice from ${agent}`, cents: 28500, status: "Due before filing", action: "View invoice" },
      stage: { title: "Where your return stands", caption: "Step 3 of 8 · Documents", stage: "documents" },
    },
  };
}
