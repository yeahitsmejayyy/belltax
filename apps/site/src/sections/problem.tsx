import { CircleQuestionMark, Folder, ReceiptText } from "lucide-react";

import { Section, SectionHeading } from "@/components/marketing/section";

// The problem (marketing 03): three things that make tax season feel like work.

const PROBLEMS = [
  { icon: Folder, title: "Paperwork everywhere", body: "Forms arrive by mail, email and apps. Gathering it all, then driving it to an office, eats a whole afternoon." },
  { icon: CircleQuestionMark, title: "No idea what’s happening", body: "Once you hand things over, it goes quiet. Is it filed? Are they waiting on you? You end up calling to ask." },
  { icon: ReceiptText, title: "A bill you didn’t expect", body: "The price shows up at the end, after the work is done, and it’s rarely the number you had in mind." },
];

export function Problem() {
  return (
    <Section id="problem">
      <SectionHeading
        id="problem"
        eyebrow="The problem"
        title={<>Getting your taxes done shouldn’t feel like a second&nbsp;job</>}
        lead={<>Most people aren’t confused by their taxes. They’re worn out by everything around&nbsp;them.</>}
      />
      <ul className="grid gap-4 md:grid-cols-3">
        {PROBLEMS.map((p) => (
          <li key={p.title} className="flex flex-col gap-2.5 rounded-2xl border bg-card p-6 text-card-foreground">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-muted">
              <p.icon aria-hidden="true" className="size-5" />
            </span>
            <h3 className="text-lg font-semibold text-balance">{p.title}</h3>
            <p className="text-base leading-relaxed md:text-[0.9375rem] text-pretty text-muted-foreground">{p.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
