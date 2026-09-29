import { Search } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";
import { ModeToggle } from "./mode-toggle";
import { CommandPalette, InlineSearch, type SearchGroup } from "./command-search";
import { SidebarTrigger } from "./sidebar";

// The bar above every admin page (.assets/screens/admin/desktop/*): the sidebar trigger, a short divider, the
// page title, then on the right the search field (type and pick from the results under it; ⌘K opens the full
// palette), the theme toggle, and the page's one primary action (usually the Invite client split button). On
// phones the field becomes an icon that opens the palette.

/** ⌘K (Ctrl+K on Windows and Linux) anywhere on the page. */
export function useCommandShortcut(onOpen: () => void, key = "k") {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === key && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpen();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onOpen, key]);
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

type AppHeaderProps = {
  title: React.ReactNode;
  // Results for both the header field and the ⌘K palette (see command-search.tsx).
  search?: { groups: SearchGroup[]; placeholder?: string; onQueryChange?: (q: string) => void; filter?: boolean };
  action?: React.ReactNode; // the page's one primary action
  modeToggle?: boolean;
  className?: string;
};

export function AppHeader({ title, search, action, modeToggle = true, className }: AppHeaderProps) {
  const [palette, setPalette] = React.useState(false);
  useCommandShortcut(React.useCallback(() => setPalette((o) => !o), []), search ? "k" : "\u0000");
  const shortcut = isMac() ? "⌘K" : "Ctrl K";

  return (
    <header data-slot="app-header" className={cn("sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur", className)}>
      <SidebarTrigger className="-ml-1 size-8" />
      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
      <h1 className="min-w-0 truncate text-sm font-medium">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        {search ? (
          <>
            <InlineSearch {...search} shortcut={shortcut} className="hidden md:block" />
            <Button variant="ghost" size="icon" onClick={() => setPalette(true)} aria-label="Search" className="md:hidden">
              <Search />
            </Button>
            <CommandPalette {...search} open={palette} onOpenChange={setPalette} />
          </>
        ) : null}
        {modeToggle ? <ModeToggle /> : null}
        {action}
      </div>
    </header>
  );
}
