import { cn } from "@app/ui/utils";
import { ChevronDown } from "lucide-react";
import * as React from "react";

// A one-open-at-a-time accordion (marketing 10-desktop-faq), on the WAI-ARIA pattern: a heading wraps each
// button, aria-expanded/aria-controls tie it to its region, and a closed panel is inert so it can't be tabbed into.

export type AccordionItem = { id: string; title: string; body: React.ReactNode };

export function Accordion({ items, defaultOpen = null }: { items: AccordionItem[]; defaultOpen?: string | null }) {
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
                onClick={() => setOpen(expanded ? null : it.id)}
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
