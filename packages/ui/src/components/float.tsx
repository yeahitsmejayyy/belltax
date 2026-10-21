import * as React from "react";

import { cn } from "../utils";

// A slow 6s drift for the hero's portal screens (the prototype's mk-float). Transform only, so nothing reflows,
// and it never starts when the visitor asks for reduced motion.

export function Float({ delay = 0, className, children }: { delay?: number; className?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const a = el.animate([{ transform: "translateY(0)" }, { transform: "translateY(-10px)" }, { transform: "translateY(0)" }], {
      duration: 6000,
      delay,
      iterations: Infinity,
      easing: "ease-in-out",
    });
    return () => a.cancel();
  }, [delay]);
  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}
