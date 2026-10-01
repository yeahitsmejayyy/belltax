import { Accordion, type AccordionItem } from "@/components/pricing/accordion";
import { SectionIntro } from "@/components/pricing/section-intro";
import { useNames } from "@/lib/public";

// FAQ (marketing 10-desktop-faq): the prototype's seven questions plus three honest ones about where documents
// live and who sees them. The preparer's name comes from the practice settings.

export function Faq() {
  const { preparerFirst } = useNames();
  const who = preparerFirst.charAt(0).toUpperCase() + preparerFirst.slice(1);
  const items: AccordionItem[] = [
    { id: "faq-in-person", title: "Do I need to come in person?", body: `No. Everything happens in your portal: questions, documents, signing and payment. If you’d rather talk something through, ${preparerFirst} is a phone call or email away.` },
    { id: "faq-documents", title: "What documents will I need?", body: "Usually your W-2s, any 1099s, IHSS paystubs if you’re a home care provider, last year’s return, and a photo ID. After you answer the intake questions, the portal lists exactly what’s needed for your situation." },
    { id: "faq-ihss", title: "I’m an IHSS caregiver. Can you help?", body: `Yes. IHSS income comes up often, and there’s no extra charge to include it. If you care for a family member, ${preparerFirst} will walk you through how that pay is reported.` },
    { id: "faq-cost", title: "How much will it cost, and when do I pay?", body: "Your price is the flat package for your filing status, plus any add-ons that apply. You see the invoice in your portal before your return is filed, and you pay online by card." },
    { id: "faq-time", title: "How long does it take?", body: "Most returns are ready within a week or two of receiving all your documents. The portal shows each step, so you never have to wonder." },
    { id: "faq-safe", title: "Is my information safe?", body: "Your documents go straight to your private portal, not through email. Your Social Security and bank numbers are always shown masked, even to you." },
    { id: "faq-stored", title: "Where are my documents stored?", body: `On one computer that ${preparerFirst} keeps and controls, not a shared cloud drive. Its disk is encrypted, and backups are encrypted before they’re saved. Uploads are deleted two years after your return is complete.` },
    { id: "faq-who-sees", title: "Who can see my documents?", body: `You, anyone on the same return as you (like a spouse filing jointly), and ${preparerFirst}. Nobody else has an account that can open them.` },
    { id: "faq-share", title: "Do you sell or share my information?", body: "No. It’s used to prepare and file your return, and it goes to the IRS and California’s Franchise Tax Board only when your return is filed. It is never sold." },
    { id: "faq-letter", title: "What if I get a letter from the IRS later?", body: `Send it through the portal or by email. ${who} prepared your return, so you’ll hear in plain words what it means and what to do next.` },
  ];

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-18 border-t px-4 py-14 md:px-6 md:py-22 lg:px-8">
      <div className="mx-auto grid max-w-3xl gap-8">
        <SectionIntro id="faq-title" eyebrow="Questions" title="Frequently asked questions" />
        <Accordion items={items} defaultOpen="faq-in-person" />
      </div>
    </section>
  );
}
