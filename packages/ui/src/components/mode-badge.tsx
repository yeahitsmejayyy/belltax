import type * as React from "react";

import { cn } from "../utils";

// Always visible in the admin (principles.md rule 12): which world is this?
// Reference: the sidebar footer in any .assets/screens/admin/desktop/ screen.
/** `label` replaces the words ("Demo · sample data" / "Live · client data"). */
export function ModeBadge({ mode, label, className, ...props }: { mode: "demo" | "live"; label?: React.ReactNode } & React.ComponentProps<"div">) {
  const demo = mode === "demo";
  return (
    <div
      data-slot="mode-badge"
      data-mode={mode}
      role="status"
      className={cn(
        "flex h-8 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold",
        demo ? "bg-mode-demo text-mode-demo-foreground" : "bg-success-subtle text-success-foreground",
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label ?? (demo ? "Demo · sample data" : "Live · client data")}
    </div>
  );
}
