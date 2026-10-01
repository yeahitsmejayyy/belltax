import type { PublicPricing } from "@app/schema";
import { Skeleton } from "@app/ui/components/skeleton";
import { formatCents } from "@app/ui/format";

import { PackageCard, type PriceState } from "@/components/pricing/package-card";
import { SectionIntro } from "@/components/pricing/section-intro";
import { useNames, usePublic } from "@/lib/public";

// Pricing (marketing 07-desktop-pricing, 08 dark, 15-phone-m-pricing). Every amount comes from the portal's
// pricing.public, which is what the admin charges; until it answers there are skeletons, and if it can't, no numbers.

type Status = "single" | "mfj" | "hoh";
type Package = PublicPricing["packages"][number];

// The design's three cards. Names and descriptions are fallbacks until the portal's own arrive.
const CARDS: { status: Status; name: string; description: string; items: string[]; featured?: boolean }[] = [
  { status: "single", name: "Single", description: "One person, no dependents", items: ["Federal and California returns", "E-file for both", "W-2 and IHSS income", "Your own portal"] },
  { status: "mfj", name: "Married filing jointly", description: "Two spouses on one return", featured: true, items: ["Federal and California returns", "E-file for both", "Dependents and child credits", "Both spouses’ W-2s and IHSS pay"] },
  { status: "hoh", name: "Head of household", description: "Unmarried, with a dependent", items: ["Federal and California returns", "E-file for both", "Dependents and child credits", "Your own portal"] },
];

// "$225", not "$225.00"; cents stay when there are any.
const amount = (cents: number) => formatCents(cents).replace(/\.00$/, "");

export function Pricing() {
  const { pricing, status } = usePublic();
  const { email, preparerFirst } = useNames();
  const pkg = (s: Package["filingStatus"]) => pricing?.packages.find((p) => p.filingStatus === s);
  const priceOf = (p: Package | undefined): PriceState =>
    status === "loading" ? { status: "loading" } : p ? { status: "ready", amount: amount(p.unitAmountCents) } : { status: "unavailable" };
  // No checkout until Stripe (ticket 09): each card opens an email to the practice.
  const start = (name: string) => (email ? `mailto:${email}?subject=${encodeURIComponent(`New client — ${name}`)}` : "#cta");
  const cards = status === "ready" ? CARDS.filter((c) => pkg(c.status)) : CARDS;
  const mfs = pkg("mfs");

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-18 bg-muted/40 px-4 py-14 md:px-6 md:py-22 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-10">
        <SectionIntro id="pricing-title" eyebrow="Pricing" title="One flat price, known up front">
          Every price includes your federal and California returns and e-filing both. You see the invoice before anything is
          filed, and you pay online.
        </SectionIntro>

        {status === "unavailable" ? (
          <p role="status" className="text-center text-[15px] text-pretty text-muted-foreground">
            Prices load from our client portal; it’s not answering right now.
          </p>
        ) : null}

        <div aria-busy={status === "loading"} className="grid items-stretch gap-6 md:grid-cols-3 md:gap-4">
          {cards.map((c) => {
            const p = pkg(c.status);
            const name = p?.name ?? c.name;
            return (
              <PackageCard
                key={c.status}
                name={name}
                description={p?.description || c.description}
                price={priceOf(p)}
                items={c.items}
                href={start(name)}
                featured={c.featured}
              />
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid content-start gap-3.5 rounded-xl border bg-card p-6 text-card-foreground">
            <h3 className="text-base font-semibold text-balance">Add-ons, only if they apply</h3>
            {status === "ready" && pricing ? (
              <ul className="grid gap-3">
                {pricing.addons.map((a) => (
                  <li key={a.code} className="flex items-baseline gap-3">
                    <span className="grid flex-1 gap-0.5">
                      <span className="text-[15px]">{a.name}</span>
                      {a.description ? <span className="text-sm text-pretty text-muted-foreground">{a.description}</span> : null}
                    </span>
                    <span className="text-[15px] font-semibold tabular-nums">{a.unitAmountCents === null ? "Included" : `+${amount(a.unitAmountCents)}`}</span>
                  </li>
                ))}
              </ul>
            ) : status === "loading" ? (
              <div className="grid gap-3" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}
              </div>
            ) : (
              <p className="text-[15px] text-pretty text-muted-foreground">
                Some situations add a small, fixed charge, like side work or an extra state. They’re listed here when the
                portal answers.
              </p>
            )}
          </div>

          <div className="grid content-start gap-2.5 rounded-xl border bg-card p-6 text-card-foreground">
            <h3 className="text-base font-semibold text-balance">Married and filing separately?</h3>
            <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
              {status === "loading" ? (
                <Skeleton className="inline-block h-4 w-48 align-middle" aria-hidden="true" />
              ) : mfs ? (
                <>Each spouse’s return is {amount(mfs.unitAmountCents)}.</>
              ) : (
                <>Each spouse files their own return, priced per return.</>
              )}{" "}
              {preparerFirst.charAt(0).toUpperCase() + preparerFirst.slice(1)} will tell you in plain words whether filing
              jointly or separately works out better for your household before you decide.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
