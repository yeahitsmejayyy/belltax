import { Check } from "lucide-react";
import type * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";
import { SectionIntro } from "./marketing";
import { Skeleton } from "./skeleton";

// The marketing site's pricing (marketing 07-desktop-pricing, 08 dark, 15-phone-m-pricing). Every amount arrives as a
// prop, already formatted: the site reads them from the portal's pricing.public, which is what the admin charges. While
// they load there are same-size skeletons, and if they can't be had, no numbers at all (never stale ones).

/** Where the prices stand: on their way, here, or not to be had. */
export type PricingStatus = "loading" | "ready" | "unavailable";

/** One card's price. The amount is display-ready ("$225"). */
export type PriceState = { status: "loading" } | { status: "ready"; amount: string } | { status: "unavailable" };

/** The words on a package card that aren't the package's own. */
export type PackageCardLabels = {
  /** After the amount, like "per return". */
  unit: string;
  /** In place of the amount when prices can't be had. */
  unavailable: string;
  /** The card's button; the package name follows for screen readers. */
  action: string;
};

export type PackageCardProps = {
  name: string;
  description: string;
  price: PriceState;
  items: string[];
  href: string;
  /** The badge on the featured card, like "Most families". A badge makes the card the featured one. */
  badge?: string;
  labels: PackageCardLabels;
};

/** One flat package. The amount row keeps its height in every state (loading, ready, unavailable) so nothing shifts when prices arrive. */
export function PackageCard({ name, description, price, items, href, badge, labels }: PackageCardProps) {
  const featured = !!badge;
  return (
    <article
      aria-label={name}
      className={cn(
        "relative flex flex-col gap-5 rounded-2xl border bg-card px-6 pt-7 pb-6 text-card-foreground",
        featured && "border-primary shadow-[0_20px_40px_-24px_color-mix(in_oklch,var(--primary)_60%,transparent)]",
      )}
    >
      {featured ? (
        <span className="absolute -top-3 left-6 inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-xs font-semibold text-primary-foreground">
          {badge}
        </span>
      ) : null}
      <div className="grid gap-1.5">
        <h3 className="text-lg font-semibold text-balance">{name}</h3>
        <p className="text-sm text-pretty text-muted-foreground">{description}</p>
      </div>
      <div className="flex h-11 items-baseline gap-1.5">
        {price.status === "ready" ? (
          <>
            <span className="text-[44px] leading-none font-semibold tracking-tighter tabular-nums">{price.amount}</span>
            <span className="text-sm text-muted-foreground">{labels.unit}</span>
          </>
        ) : price.status === "loading" ? (
          <Skeleton className="h-11 w-36" aria-hidden="true" />
        ) : (
          <span className="self-center text-sm text-muted-foreground">{labels.unavailable}</span>
        )}
      </div>
      <ul className="grid flex-1 content-start gap-2.5">
        {items.map((it) => (
          <li key={it} className="flex gap-2.5 text-[15px] text-pretty">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            {it}
          </li>
        ))}
      </ul>
      <Button asChild size="touch" variant={featured ? "default" : "outline"} className="w-full text-[15px]">
        <a href={href}>
          {labels.action}<span className="sr-only">: {name}</span>
        </a>
      </Button>
    </article>
  );
}

/** An add-on line: its name, an optional line under it, and its price as shown ("+$85", or "Included"). */
export type AddonLine = { key: string; name: string; description?: string | null; price: string };

/** The add-ons card: the lines once prices are ready, skeletons while loading, otherwise `empty`. */
export function AddonsCard({ title, status, items, empty }: { title: string; status: PricingStatus; items: AddonLine[] | null; empty: React.ReactNode }) {
  return (
    <div className="grid content-start gap-3.5 rounded-xl border bg-card p-6 text-card-foreground">
      <h3 className="text-base font-semibold text-balance">{title}</h3>
      {status === "ready" && items ? (
        <ul className="grid gap-3">
          {items.map((a) => (
            <li key={a.key} className="flex items-baseline gap-3">
              <span className="grid flex-1 gap-0.5">
                <span className="text-[15px]">{a.name}</span>
                {a.description ? <span className="text-sm text-pretty text-muted-foreground">{a.description}</span> : null}
              </span>
              <span className="text-[15px] font-semibold tabular-nums">{a.price}</span>
            </li>
          ))}
        </ul>
      ) : status === "loading" ? (
        <div className="grid gap-3" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}
        </div>
      ) : (
        <p className="text-[15px] text-pretty text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

/** A small card beside the add-ons: a title, then `lead` (a skeleton while loading) and `body` in one paragraph. */
export function PricingNote({ title, status, lead, body }: { title: string; status: PricingStatus; lead: React.ReactNode; body: React.ReactNode }) {
  return (
    <div className="grid content-start gap-2.5 rounded-xl border bg-card p-6 text-card-foreground">
      <h3 className="text-base font-semibold text-balance">{title}</h3>
      <p className="text-[15px] leading-relaxed text-pretty text-muted-foreground">
        {status === "loading" ? <Skeleton className="inline-block h-4 w-48 align-middle" aria-hidden="true" /> : lead}{" "}
        {body}
      </p>
    </div>
  );
}

/** The pricing section: the intro, a status line when prices can't be had, the package cards, then the add-ons and a note. */
export function PricingSection({ id = "pricing", eyebrow, title, lead, status, unavailableMessage, cards, addons, note }: {
  id?: string;
  eyebrow: string;
  title: string;
  lead?: React.ReactNode;
  status: PricingStatus;
  /** Said (as a status) when prices can't be had. */
  unavailableMessage: React.ReactNode;
  cards: (PackageCardProps & { key: string })[];
  addons: React.ComponentProps<typeof AddonsCard>;
  note: React.ComponentProps<typeof PricingNote>;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-18 bg-muted/40 px-4 py-14 md:px-6 md:py-22 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-10">
        <SectionIntro id={`${id}-title`} eyebrow={eyebrow} title={title}>
          {lead}
        </SectionIntro>

        {status === "unavailable" ? (
          <p role="status" className="text-center text-[15px] text-pretty text-muted-foreground">
            {unavailableMessage}
          </p>
        ) : null}

        <div aria-busy={status === "loading"} className="grid items-stretch gap-6 md:grid-cols-3 md:gap-4">
          {cards.map(({ key, ...c }) => (
            <PackageCard key={key} {...c} />
          ))}
        </div>

        <div className="grid items-start gap-4 md:grid-cols-2">
          <AddonsCard {...addons} />
          <PricingNote {...note} />
        </div>
      </div>
    </section>
  );
}
