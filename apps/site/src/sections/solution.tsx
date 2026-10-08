import { Check } from "lucide-react";

import { DesktopHome } from "@/components/marketing/portal-mockups";
import { bookingYear } from "@/components/marketing/practice";
import { Section, SectionHeading } from "@/components/marketing/section";
import { useNames } from "@/lib/public";

// The solution (marketing 04): your personal tax agent, one portal. The screenshot is the portal home drawn in HTML
// with invented data, read out as a single image.

export function Solution() {
  const { brand, agent, Agent } = useNames();
  const points = [
    { title: "A real tax agent, every time", body: `${Agent} prepares your return from start to finish. No hand-offs, no call center.` },
    { title: "Status you can see", body: "Your portal shows each stage, from intake to filed, and anything waiting on you." },
    { title: "The price before the work", body: "Flat pricing by filing status. Your invoice is in the portal before anything is filed." },
  ];

  return (
    <Section id="solution" muted>
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="grid gap-4">
          <SectionHeading
            id="solution"
            eyebrow="The solution"
            title={<>Your personal tax agent, and one place to see&nbsp;it&nbsp;all</>}
            lead={<>{brand} pairs you with a personal tax agent who prepares your return, and your private portal shows you exactly where it&nbsp;stands. All from your&nbsp;phone.</>}
          />
          <ul className="mt-2 grid gap-3.5">
            {points.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check aria-hidden="true" className="size-3.5" />
                </span>
                <span className="grid gap-0.5">
                  <span className="font-semibold">{p.title}</span>
                  <span className="text-base text-pretty text-muted-foreground md:text-[0.9375rem]">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <figure role="img" aria-label="A sample client portal home: four things the client still needs to do, an invoice, and the return at step 3 of 8, Documents.">
          <DesktopHome agent={agent} year={bookingYear() - 1} />
        </figure>
      </div>
    </Section>
  );
}
