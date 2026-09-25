import type * as React from "react";

import { formatCents } from "../format";
import { cn } from "../utils";

// Amounts always line up: tabular figures, never wrapped.
export function Money({ cents, className, ...props }: { cents: number } & React.ComponentProps<"span">) {
  return (
    <span data-slot="money" className={cn("whitespace-nowrap tabular-nums", className)} {...props}>
      {formatCents(cents)}
    </span>
  );
}
