import { ChevronDown } from "lucide-react";
import type * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";

// A primary action with its close relatives behind a chevron: "Invite client", and in the menu
// "Add client without invite". Reference: .assets/screens/admin/desktop/09-pipeline-invite-menu.png.

type SplitButtonProps = {
  label: React.ReactNode;
  onClick: () => void;
  menuLabel?: string; // accessible name for the chevron
  items: { label: React.ReactNode; description?: string; onSelect: () => void }[];
  disabled?: boolean;
  className?: string;
};

export function SplitButton({ label, onClick, menuLabel = "More options", items, disabled, className }: SplitButtonProps) {
  return (
    <div data-slot="split-button" className={cn("inline-flex rounded-md shadow-xs", className)}>
      <Button className="rounded-r-none" onClick={onClick} disabled={disabled}>
        {label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label={menuLabel} size="icon" className="rounded-l-none border-l border-primary-foreground/25" disabled={disabled}>
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {items.map((item, i) => (
            <DropdownMenuItem key={i} onSelect={item.onSelect} className="flex-col items-start gap-0.5">
              <span className="font-medium">{item.label}</span>
              {item.description ? <span className="text-xs text-muted-foreground">{item.description}</span> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
