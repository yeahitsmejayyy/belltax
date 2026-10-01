import { Camera, CreditCard, House, ListChecks, Lock, PenLine } from "lucide-react";

import { Section, SectionHeading } from "@/components/marketing/section";

// Features (marketing 06): six cards, one per thing the portal does for the client.

const FEATURES = [
  { icon: Camera, title: "Upload from your phone", body: "Take a photo of each form. If a picture is hard to read, you’ll hear why and can retake it." },
  { icon: ListChecks, title: "Plain questions", body: "Short steps about your household, income and year. Save and come back any time." },
  { icon: House, title: "Always know what’s next", body: "A clear timeline and a short list of what’s waiting on you. Nothing else." },
  { icon: PenLine, title: "Sign online", body: "Read your engagement letter and sign by typing your name. Done in under a minute." },
  { icon: CreditCard, title: "Pay online", body: "Pay by card when your return is ready. If a payment doesn’t go through, retrying is easy." },
  { icon: Lock, title: "Private by default", body: "Your documents live in your portal, not an inbox. Sensitive numbers are always masked." },
];

export function Features() {
  return (
    <Section id="features">
      <SectionHeading id="features" eyebrow="Features" title={<>Built for people with busy&nbsp;lives</>} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex flex-col gap-2.5 rounded-2xl border bg-card p-6 text-card-foreground">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-brand-subtle text-brand-subtle-foreground">
              <f.icon aria-hidden="true" className="size-5" />
            </span>
            <h3 className="text-lg font-semibold text-balance">{f.title}</h3>
            <p className="text-base leading-relaxed md:text-[0.9375rem] text-pretty text-muted-foreground">{f.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
