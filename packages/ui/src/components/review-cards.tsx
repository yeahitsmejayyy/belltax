import { cn } from "../utils";

// Client quotes for the marketing site (marketing 09-desktop-reviews). Presentational only: the site doesn't render
// it until there are real quotes, given with the client's consent to publish.

export type ReviewQuote = { quote: string; name: string; detail: string };

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export function ReviewCards({ quotes, className }: { quotes: ReviewQuote[]; className?: string }) {
  return (
    <ul data-slot="review-cards" className={cn("grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]", className)}>
      {quotes.map((q) => (
        <li key={`${q.name}-${q.quote.slice(0, 24)}`} className="flex">
          <figure className="flex flex-1 flex-col gap-5 rounded-xl border bg-card p-6 text-card-foreground">
            <blockquote className="text-[17px] leading-relaxed text-pretty">“{q.quote}”</blockquote>
            <figcaption className="mt-auto flex items-center gap-3">
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand-subtle-foreground">
                {initials(q.name)}
              </span>
              <span className="grid leading-snug">
                <span className="text-[15px] font-semibold">{q.name}</span>
                <span className="text-sm text-pretty text-muted-foreground">{q.detail}</span>
              </span>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
