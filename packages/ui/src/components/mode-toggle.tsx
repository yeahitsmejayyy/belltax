import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "../utils";
import { Button } from "./button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "./dropdown-menu";
import { useTheme } from "./theme-provider";

// Three ways to switch theme:
//  - "icon" (the default): a ghost button showing the sun or the moon; one click flips it, and the icons
//    turn and swap as it does.
//  - "switch": a slide toggle with the sun and the moon on its track.
//  - "menu": Light / Dark / System, for a settings page where "follow my system" matters.

type ModeToggleProps = { variant?: "icon" | "switch" | "menu"; className?: string };

export function ModeToggle({ variant = "icon", className }: ModeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const flip = () => setTheme(dark ? "light" : "dark");

  if (variant === "switch") {
    return (
      <SwitchPrimitive.Root
        data-slot="mode-toggle"
        checked={dark}
        onCheckedChange={(on) => setTheme(on ? "dark" : "light")}
        aria-label="Dark mode"
        className={cn(
          "group relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border bg-muted p-0.5 transition-colors duration-300 ease-standard outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:bg-secondary",
          className,
        )}
      >
        <Sun aria-hidden="true" className="absolute left-2 size-3.5 text-muted-foreground" />
        <Moon aria-hidden="true" className="absolute right-2 size-3.5 text-muted-foreground" />
        <SwitchPrimitive.Thumb className="relative z-10 flex size-6 items-center justify-center rounded-full bg-background shadow-sm transition-transform duration-300 ease-emphasized data-[state=checked]:translate-x-6">
          <Sun aria-hidden="true" className="absolute size-3.5 text-warning-foreground transition-all duration-300 ease-emphasized group-data-[state=checked]:scale-0 group-data-[state=checked]:-rotate-90" />
          <Moon aria-hidden="true" className="absolute size-3.5 scale-0 rotate-90 text-brand-subtle-foreground transition-all duration-300 ease-emphasized group-data-[state=checked]:scale-100 group-data-[state=checked]:rotate-0" />
        </SwitchPrimitive.Thumb>
      </SwitchPrimitive.Root>
    );
  }

  if (variant === "menu") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button data-slot="mode-toggle" variant="outline" size="icon" aria-label="Theme" className={cn("relative", className)}>
            <ThemeIcons dark={dark} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
            <DropdownMenuRadioItem value="light"><Sun /> Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark"><Moon /> Dark</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system"><Monitor /> System</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      data-slot="mode-toggle"
      variant="ghost"
      size="icon"
      onClick={flip}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn("relative overflow-hidden", className)}
    >
      <ThemeIcons dark={dark} />
    </Button>
  );
}

// The sun turns away and shrinks as the moon turns in (300ms, eased, no bounce: principles.md rule 7).
function ThemeIcons({ dark }: { dark: boolean }) {
  return (
    <>
      <Sun aria-hidden="true" className={cn("size-[1.15rem] transition-all duration-300 ease-emphasized", dark ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100")} />
      <Moon aria-hidden="true" className={cn("absolute size-[1.15rem] transition-all duration-300 ease-emphasized", dark ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0")} />
    </>
  );
}
