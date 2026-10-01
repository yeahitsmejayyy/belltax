import { Button } from "@app/ui/components/button";
import { Skeleton } from "@app/ui/components/skeleton";
import { cn } from "@app/ui/utils";
import { Check } from "lucide-react";

// One flat package (marketing 07-desktop-pricing, 15-phone-m-pricing). The amount row keeps its height in every
// state (loading, ready, unavailable) so nothing shifts when prices arrive.

export type PriceState = { status: "loading" } | { status: "ready"; amount: string } | { status: "unavailable" };

export function PackageCard({ name, description, price, items, href, featured = false }: {
  name: string;
  description: string;
  price: PriceState;
  items: string[];
  href: string;
  featured?: boolean;
}) {
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
          Most families
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
            <span className="text-sm text-muted-foreground">per return</span>
          </>
        ) : price.status === "loading" ? (
          <Skeleton className="h-11 w-36" aria-hidden="true" />
        ) : (
          <span className="self-center text-sm text-muted-foreground">Price shown when the portal answers</span>
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
          Get started<span className="sr-only">: {name}</span>
        </a>
      </Button>
    </article>
  );
}
