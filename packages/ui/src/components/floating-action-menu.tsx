import { Plus, X } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";

// The round button on phones that opens a short list of jumps (admin phone quick-jump, marketing
// 14-phone-m-menu). Escape closes it; focus returns to the button.

export type FabItem = { label: string; icon?: React.ComponentType<{ className?: string }>; onSelect: () => void };

export function FloatingActionMenu({ items, label = "Quick actions", icon: Icon = Plus, className }: { items: FabItem[]; label?: string; icon?: React.ComponentType<{ className?: string }>; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const button = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div data-slot="floating-action-menu" className={cn("fixed right-4 bottom-[calc(5rem+max(env(safe-area-inset-bottom),var(--safe-bottom,0px)))] z-40 flex flex-col items-end gap-3 md:hidden", className)}>
      {open ? (
        <ul id={menuId} role="menu" aria-label={label} className="grid min-w-48 animate-page gap-1 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg">
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                role="menuitem"
                type="button"
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-base hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon ? <item.icon className="size-5 text-muted-foreground" /> : null}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        ref={button}
        type="button"
        aria-label={open ? "Close" : label}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 ease-standard hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95"
      >
        {open ? <X className="size-6" /> : <Icon className="size-6" />}
      </button>
    </div>
  );
}
