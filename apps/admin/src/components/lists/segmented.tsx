import type * as React from "react";

import { cn } from "@app/ui/utils";

// A row of joined toggle buttons (admin 29 invoice tabs, 30 actor filter). One is always pressed;
// the pressed one is marked by weight and fill, and by aria-pressed for screen readers.
export function Segmented<T extends string>({ label, value, options, onChange, className }: { label: string; value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex max-w-full overflow-x-auto rounded-lg border bg-background", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-11 shrink-0 border-r px-3 text-sm whitespace-nowrap text-muted-foreground outline-none last:border-r-0 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-9",
            o.value === value && "bg-muted font-medium text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
