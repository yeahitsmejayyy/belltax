import { ArrowRight, CircleQuestionMark, House, ListChecks, Lock, Menu, ReceiptText } from "lucide-react";

import { Button } from "@app/ui/components/button";
import { FloatingActionMenu } from "@app/ui/components/floating-action-menu";
import { Logo } from "@app/ui/components/logo";
import { ModeToggle } from "@app/ui/components/mode-toggle";

import { useStartHref } from "@/components/marketing/practice";
import { portalUrl } from "@/lib/public";

// The sticky header (marketing 01, 02) and, on phones, the round menu button (14-phone-m-menu).

const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function Header() {
  const start = useStartHref();
  const go = (href: string) => () => window.location.assign(href);

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-4 md:gap-4 md:px-6">
          <a href="#main" aria-label="BellTaxPrep, back to top" className="flex min-h-11 shrink-0 items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Logo />
          </a>
          <nav aria-label="Sections" className="hidden flex-1 justify-center gap-1 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="inline-flex h-9 items-center rounded-md px-2.5 text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none lg:px-3">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <ModeToggle className="size-11 md:size-9" />
            <Button asChild variant="ghost" className="hidden md:inline-flex">
              <a href={portalUrl("/sign-in")}>Sign in</a>
            </Button>
            <Button asChild className="h-11 px-4 text-base md:h-9 md:text-sm">
              <a href={start}>Get started</a>
            </Button>
          </div>
        </div>
      </header>
      <FloatingActionMenu
        label="Menu"
        icon={Menu}
        className="bottom-4"
        items={[
          { label: "Get started", icon: ArrowRight, onSelect: go(start) },
          { label: "Client sign in", icon: Lock, onSelect: go(portalUrl("/sign-in")) },
          { label: "How it works", icon: ListChecks, onSelect: go("#how") },
          { label: "Features", icon: House, onSelect: go("#features") },
          { label: "Pricing", icon: ReceiptText, onSelect: go("#pricing") },
          { label: "FAQ", icon: CircleQuestionMark, onSelect: go("#faq") },
        ]}
      />
    </>
  );
}
