import { cn } from "@app/ui/utils";
import type * as React from "react";

// The phone the walkthrough plays in (marketing 05 / 16): a 390 × 844 screen drawn in CSS, scaled down with a
// transform inside a box of fixed size, so it never shifts the layout. Decorative: inert and hidden from
// screen readers (the section's live region says what it shows).

export function PhoneFrame({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div aria-hidden="true" inert className={cn("relative h-[557px] w-[258px] shrink-0 md:h-[625px] md:w-[289px]", className)} {...props}>
      <div className="absolute top-0 left-0 h-[844px] w-[390px] origin-top-left scale-[0.66] overflow-hidden rounded-[56px] border-[3px] border-border bg-background text-foreground shadow-2xl select-none md:scale-[0.74]">
        <div className="absolute top-3 left-1/2 z-30 h-9 w-32 -translate-x-1/2 rounded-full bg-foreground/15" />
        {children}
        <div className="absolute bottom-2 left-1/2 z-30 h-1.5 w-36 -translate-x-1/2 rounded-full bg-foreground/30" />
      </div>
    </div>
  );
}
