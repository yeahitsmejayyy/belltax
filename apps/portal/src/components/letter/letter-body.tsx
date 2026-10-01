import { cn } from "@app/ui/utils";

// The letter's text as the server stored it (and as it was hashed): the first paragraph is its title, a
// paragraph starting "1. " is a numbered section with its heading on the first line. Line breaks are kept.
export function LetterBody({ body, className }: { body: string; className?: string }) {
  const [title, ...paragraphs] = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <article aria-label="Engagement letter" className={cn("grid max-w-[65ch] gap-4 text-base leading-relaxed text-pretty", className)}>
      {title ? <h2 className="text-lg font-semibold whitespace-pre-line">{title}</h2> : null}
      {paragraphs.map((p, i) => {
        const [first, ...rest] = p.split("\n");
        return /^\d+\.\s/.test(first!) ? (
          <section key={i} className="grid gap-1">
            <h3 className="font-semibold">{first}</h3>
            {rest.length ? <p className="whitespace-pre-line">{rest.join("\n")}</p> : null}
          </section>
        ) : (
          <p key={i} className={cn("whitespace-pre-line", i === 0 && "text-muted-foreground")}>
            {p}
          </p>
        );
      })}
    </article>
  );
}
