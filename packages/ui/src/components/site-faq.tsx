import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { SectionIntro } from "./marketing";

// The marketing site's questions (marketing 10-desktop-faq): a one-open-at-a-time accordion on the WAI-ARIA pattern
// (a heading wraps each button, aria-expanded/aria-controls tie it to its region, and a closed panel is inert so it
// can't be tabbed into), and the section around it. The questions and answers come from the site.

/** One question. `id` prefixes the button and panel ids, so it must be unique on the page. */
export type AccordionItem = { id: string; title: string; body: React.ReactNode };

/** One open at a time; `defaultOpen` is the id open at first (none by default). `onOpenChange` hears every change. */
export function Accordion({ items, defaultOpen = null, onOpenChange }: { items: AccordionItem[]; defaultOpen?: string | null; onOpenChange?: (id: string | null) => void }) {
  const [open, setOpen] = React.useState<string | null>(defaultOpen);
  return (
    <div className="border-t">
      {items.map((it) => {
        const expanded = open === it.id;
        return (
          <div key={it.id} className="border-b">
            <h3>
              <button
                type="button"
                id={`${it.id}-button`}
                aria-expanded={expanded}
                aria-controls={`${it.id}-panel`}
                onClick={() => {
                  const next = expanded ? null : it.id;
                  setOpen(next);
                  onOpenChange?.(next);
                }}
                className="flex min-h-16 w-full cursor-pointer items-center gap-4 rounded-sm py-3 text-left text-[17px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="flex-1 text-balance">{it.title}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-standard", expanded && "rotate-180")}
                />
              </button>
            </h3>
            <div
              id={`${it.id}-panel`}
              role="region"
              aria-labelledby={`${it.id}-button`}
              inert={!expanded}
              className={cn("grid transition-[grid-template-rows] duration-200 ease-standard", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
            >
              <div className="overflow-hidden">
                <p className="pr-2 pb-5 text-base leading-relaxed text-pretty text-muted-foreground md:pr-10">{it.body}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The FAQ section: a centred intro over the accordion. Labelled by `${id}-title`. */
export function FaqSection({ id = "faq", eyebrow, title, items, defaultOpen, onOpenChange }: {
  id?: string;
  eyebrow: string;
  title: string;
  items: AccordionItem[];
  defaultOpen?: string | null;
  onOpenChange?: (id: string | null) => void;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-18 border-t px-4 py-14 md:px-6 md:py-22 lg:px-8">
      <div className="mx-auto grid max-w-3xl gap-8">
        <SectionIntro id={`${id}-title`} eyebrow={eyebrow} title={title} />
        <Accordion items={items} defaultOpen={defaultOpen} onOpenChange={onOpenChange} />
      </div>
    </section>
  );
}
