import type { PublicPricing } from "@app/schema";
import { PricingSection, type PriceState } from "@app/ui/components/site-pricing";
import { formatCents } from "@app/ui/format";

import { PRICING } from "@/content/landing";
import { useNames, usePublic } from "@/lib/public";

// Pricing (marketing 07-desktop-pricing, 08 dark, 15-phone-m-pricing). Every amount comes from the portal's
// pricing.public, which is what the admin charges; until it answers there are skeletons, and if it can't, no numbers.

type Package = PublicPricing["packages"][number];

// "$225", not "$225.00"; cents stay when there are any.
const amount = (cents: number) => formatCents(cents).replace(/\.00$/, "");

export function Pricing() {
  const { pricing, status } = usePublic();
  const { email, Agent } = useNames();
  const pkg = (s: Package["filingStatus"]) => pricing?.packages.find((p) => p.filingStatus === s);
  const priceOf = (p: Package | undefined): PriceState =>
    status === "loading" ? { status: "loading" } : p ? { status: "ready", amount: amount(p.unitAmountCents) } : { status: "unavailable" };
  const cards = status === "ready" ? PRICING.cards.filter((c) => pkg(c.status)) : PRICING.cards;
  const mfs = pkg("mfs");

  return (
    <PricingSection
      eyebrow={PRICING.eyebrow}
      title={PRICING.title}
      lead={PRICING.lead}
      status={status}
      unavailableMessage={PRICING.unavailable}
      cards={cards.map((c) => {
        const p = pkg(c.status);
        const name = p?.name ?? c.name;
        return {
          key: c.status,
          name,
          description: p?.description || c.description,
          price: priceOf(p),
          items: c.items,
          href: PRICING.startHref(email, name),
          badge: c.featured ? PRICING.featuredBadge : undefined,
          labels: PRICING.labels,
        };
      })}
      addons={{
        title: PRICING.addonsTitle,
        status,
        items: pricing?.addons.map((a) => ({ key: a.code, name: a.name, description: a.description, price: a.unitAmountCents === null ? PRICING.included : `+${amount(a.unitAmountCents)}` })) ?? null,
        empty: PRICING.addonsEmpty,
      }}
      note={{ title: PRICING.separateTitle, status, lead: PRICING.separateLead(mfs ? amount(mfs.unitAmountCents) : null), body: PRICING.separateBody(Agent) }}
    />
  );
}
