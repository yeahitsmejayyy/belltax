import { ArrowRight, Check, Play, ShieldCheck, type LucideIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";
import { Float } from "./float";
import { Wordmark } from "./logo";
import { PhoneDocuments, PhoneFrame, PhoneHome, PhoneLetterSigned, type PortalMockup } from "./portal-mockups";

// The marketing site's sections (marketing 01-11), the pieces apps/site renders and Storybook shows. Copy in through
// props and config arrays; the site keeps the words, the practice details it reads from the portal, and the page order.

/** A link the page points somewhere: a label and where it goes. */
export type MarketingLink = { label: string; href: string };

// ---------- Section frame ----------

/** The shared section frame (marketing 03-11): 1100px column, 56px/88px vertical rhythm, clears the sticky header. Labelled by `${id}-title`. */
export function Section({ id, muted, className, children }: { id: string; muted?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-16 border-t px-4 py-14 md:px-6 md:py-22", muted && "border-t-0 bg-muted", className)}>
      <div className="mx-auto grid max-w-[1100px] gap-10">{children}</div>
    </section>
  );
}

/** Eyebrow, h2 and an optional lead, left-aligned. The h2 carries `${id}-title`, the id the section is labelled by. */
export function SectionHeading({ id, eyebrow, title, lead, className }: { id: string; eyebrow: string; title: React.ReactNode; lead?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid max-w-160 gap-3", className)}>
      <p className="text-sm font-semibold text-brand-subtle-foreground">{eyebrow}</p>
      <h2 id={`${id}-title`} className="text-[1.75rem] leading-[1.15] font-bold text-balance md:text-4xl">
        {title}
      </h2>
      {lead ? <p className="text-[1.0625rem] leading-relaxed text-pretty text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

/**
 * The centred eyebrow + h2 (+ lead) that opens the pricing and FAQ sections (marketing 07, 10). `id` goes on the h2.
 * The eyebrow uses the brand-subtle foreground: the solid brand colour is under 4.5:1 for 14px text (principles 5).
 */
export function SectionIntro({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-2xl justify-items-center gap-3 text-center">
      <span className="text-sm font-semibold text-brand-subtle-foreground">{eyebrow}</span>
      <h2 id={id} className="text-[28px] leading-tight font-bold text-balance md:text-4xl">{title}</h2>
      {children ? <p className="text-[17px] leading-relaxed text-pretty text-muted-foreground">{children}</p> : null}
    </div>
  );
}

// ---------- Hero ----------

/** A hero action: a label, where it goes, and an icon (after the label on the primary, before it on the secondary). */
export type HeroAction = MarketingLink & { icon?: LucideIcon };

/** The short list of checked selling points under the hero's actions (also the splash page's). */
export function CheckPoints({ points }: { points: string[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
      {points.map((p) => (
        <li key={p} className="flex items-center gap-1.5">
          <Check aria-hidden="true" className="size-4 text-brand-subtle-foreground" />
          {p}
        </li>
      ))}
    </ul>
  );
}

/**
 * The hero (marketing 01, 02 dark, 13-phone-m-hero): the promise, two actions, the selling points, an optional
 * credential line, and `art` drifting below (decoration: hidden from assistive tech and inert).
 */
export function Hero({ id = "hero", eyebrow, title, lead, primary, secondary, points, credential, art }: {
  id?: string;
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  lead: React.ReactNode;
  primary: HeroAction;
  secondary: HeroAction;
  points: string[];
  /** A short line under the points, like how the preparer is registered. Left out when absent. */
  credential?: React.ReactNode;
  /** What floats under the hero, like HeroPhones. */
  art?: React.ReactNode;
}) {
  const PrimaryIcon = primary.icon ?? ArrowRight;
  const SecondaryIcon = secondary.icon ?? Play;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16 overflow-hidden px-4 pt-11 md:px-6 md:pt-18">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-7 text-center">
        <div className="flex max-w-180 flex-col items-center gap-3.5">
          <p className="text-sm font-medium text-pretty text-muted-foreground">{eyebrow}</p>
          <h1 id={`${id}-title`} className="text-[2.75rem] leading-[1.02] font-extrabold text-balance md:text-7xl">
            {title}
          </h1>
          <p className="max-w-140 text-[1.0625rem] leading-relaxed text-pretty text-muted-foreground md:text-lg">{lead}</p>
        </div>
        <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Button asChild className="h-12 px-8 text-base has-[>svg]:px-8">
            <a href={primary.href}>
              {primary.label} <PrimaryIcon aria-hidden="true" />
            </a>
          </Button>
          <Button asChild variant="outline" className="h-12 px-8 text-base has-[>svg]:px-8">
            <a href={secondary.href}>
              <SecondaryIcon aria-hidden="true" /> {secondary.label}
            </a>
          </Button>
        </div>
        <CheckPoints points={points} />
        {credential ? (
          <p className="-mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-3.5 text-brand-subtle-foreground" />
            {credential}
          </p>
        ) : null}
        {art ? (
          <div
            aria-hidden="true"
            inert
            // The mask only paints inside this box, so it carries room on every side (negative margins keep the layout
            // where it was): the art floats up and casts its shadows without ever touching an edge, then fades out
            // at the bottom.
            className="-mx-10 mt-0 box-content flex h-[400px] w-full max-w-240 items-start justify-center gap-3 px-10 pt-10 mask-b-from-70% select-none sm:h-[480px] md:gap-7"
          >
            {art}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** The hero's three portal phones (the sample in `data`, invented): documents, home in the middle, the signed letter. The side ones show from `lg`. */
export function HeroPhones({ data }: { data: PortalMockup }) {
  return (
    <>
      <Float delay={0} className="mt-24 hidden w-[220px] shrink-0 lg:block">
        <PhoneFrame>
          <PhoneDocuments data={data} />
        </PhoneFrame>
      </Float>
      <Float delay={1200} className="w-[260px] shrink-0 sm:w-[270px]">
        <PhoneFrame>
          <PhoneHome data={data} />
        </PhoneFrame>
      </Float>
      <Float delay={2400} className="mt-24 hidden w-[220px] shrink-0 lg:block">
        <PhoneFrame>
          <PhoneLetterSigned data={data} />
        </PhoneFrame>
      </Float>
    </>
  );
}

// ---------- Card grids (problem, features) ----------

/** One card: an icon, a title and a sentence or two. */
export type IconCardItem = { icon: LucideIcon; title: string; body: string };

/**
 * A grid of icon cards. `tone="muted"` is the problem's three across from `md`; `tone="brand"` is the features' two
 * from `sm`, three from `lg`.
 */
export function IconCards({ items, tone = "muted" }: { items: IconCardItem[]; tone?: "muted" | "brand" }) {
  return (
    <ul className={tone === "brand" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-4 md:grid-cols-3"}>
      {items.map((it) => (
        <li key={it.title} className="flex flex-col gap-2.5 rounded-2xl border bg-card p-6 text-card-foreground">
          <span className={tone === "brand" ? "flex size-10 items-center justify-center rounded-[10px] bg-brand-subtle text-brand-subtle-foreground" : "flex size-10 items-center justify-center rounded-[10px] bg-muted"}>
            <it.icon aria-hidden="true" className="size-5" />
          </span>
          <h3 className="text-lg font-semibold text-balance">{it.title}</h3>
          <p className="text-base leading-relaxed md:text-[0.9375rem] text-pretty text-muted-foreground">{it.body}</p>
        </li>
      ))}
    </ul>
  );
}

/** A section of icon cards under a heading (marketing 03 problem, 06 features). */
export function IconCardsSection({ id, eyebrow, title, lead, items, tone }: { id: string; eyebrow: string; title: React.ReactNode; lead?: React.ReactNode; items: IconCardItem[]; tone?: "muted" | "brand" }) {
  return (
    <Section id={id}>
      <SectionHeading id={id} eyebrow={eyebrow} title={title} lead={lead} />
      <IconCards items={items} tone={tone} />
    </Section>
  );
}

// ---------- Solution ----------

/** A point with a round check: a bold title and a line under it. */
export type CheckedPoint = { title: string; body: string };

/** The solution (marketing 04): heading and checked points beside a picture of the product, read out as one image (`figureLabel`). */
export function SolutionSection({ id = "solution", eyebrow, title, lead, points, figure, figureLabel }: {
  id?: string;
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  points: CheckedPoint[];
  figure: React.ReactNode;
  figureLabel: string;
}) {
  return (
    <Section id={id} muted>
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="grid gap-4">
          <SectionHeading id={id} eyebrow={eyebrow} title={title} lead={lead} />
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
        <figure role="img" aria-label={figureLabel}>
          {figure}
        </figure>
      </div>
    </Section>
  );
}

// ---------- Call to action ----------

/** The closing call to action (marketing 11): always the charcoal band (the dark tokens, in either theme) with the wordmark and one chartreuse button. */
export function CtaBand({ id = "cta", title, lead, action }: { id?: string; title: React.ReactNode; lead: React.ReactNode; action: HeroAction }) {
  const Icon = action.icon ?? ArrowRight;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16 px-4 pt-10 pb-24 md:px-6">
      <div className="dark mx-auto flex max-w-[1100px] flex-col items-center gap-4.5 rounded-3xl bg-charcoal px-5 py-11 text-center text-foreground md:px-6 md:py-16">
        <Wordmark className="h-10" />
        <h2 id={`${id}-title`} className="max-w-160 text-[1.75rem] leading-[1.15] font-bold text-balance md:text-4xl">
          {title}
        </h2>
        <p className="max-w-130 text-[1.0625rem] leading-relaxed font-medium text-pretty">{lead}</p>
        <a
          href={action.href}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground transition-colors duration-150 ease-standard hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          {action.label} <Icon aria-hidden="true" className="size-4" />
        </a>
      </div>
    </section>
  );
}
