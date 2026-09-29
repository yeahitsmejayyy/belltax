import { Command as CommandPrimitive } from "cmdk";
import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "./command";

// Search the practice two ways, over one set of results (admin 26-dialogs-and-sheets-cmdk):
//  - InlineSearch: the field in the header. Click in and type; matches drop down under it. ↑↓ to move, Enter to
//    go, Escape to close.
//  - CommandPalette: ⌘K anywhere, the same results in a dialog on the upper third.
// Results are data, not markup, so both show exactly the same thing. Filtering is cmdk's by default; pass
// `onQueryChange` and `filter={false}` when the server searches (ticket 41).

export type SearchResult = { id: string; label: string; sublabel?: string; icon?: LucideIcon; hint?: string; keywords?: string[]; onSelect: () => void };
export type SearchGroup = { heading: string; items: SearchResult[] };

function Results({ groups, query, onDone }: { groups: SearchGroup[]; query: string; onDone: () => void }) {
  return (
    <>
      <CommandEmpty>{query ? `Nothing matches “${query}”.` : "Start typing to search."}</CommandEmpty>
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <CommandGroup key={g.heading} heading={g.heading}>
            {g.items.map((r) => (
              <CommandItem
                key={r.id}
                value={`${r.id} ${r.label} ${r.sublabel ?? ""}`}
                keywords={r.keywords}
                onSelect={() => {
                  r.onSelect();
                  onDone();
                }}
                className="min-h-10"
              >
                {r.icon ? <r.icon /> : null}
                <span className="grid min-w-0">
                  <span className="truncate">{r.label}</span>
                  {r.sublabel ? <span className="truncate text-xs text-muted-foreground">{r.sublabel}</span> : null}
                </span>
                {r.hint ? <CommandShortcut className="font-sans tracking-normal">{r.hint}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
    </>
  );
}

type SearchProps = {
  groups: SearchGroup[];
  placeholder?: string;
  onQueryChange?: (q: string) => void;
  filter?: boolean; // false when results come already filtered from the server
};

export function InlineSearch({ groups, placeholder = "Search clients, returns, invoices", onQueryChange, filter = true, shortcut, className }: SearchProps & { shortcut?: string; className?: string }) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLInputElement>(null);

  // Clicking anywhere else closes the results.
  React.useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const done = () => {
    setOpen(false);
    setQuery("");
    onQueryChange?.("");
    input.current?.blur();
  };

  return (
    <CommandPrimitive
      ref={root}
      data-slot="inline-search"
      label={placeholder}
      shouldFilter={filter}
      loop
      className={cn("relative w-72 lg:w-80", className)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          done();
        }
      }}
    >
      <div className="flex h-9 items-center gap-2 rounded-lg border bg-background px-3 shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 hover:bg-accent/40">
        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <CommandPrimitive.Input
          ref={input}
          value={query}
          onValueChange={(q) => {
            setQuery(q);
            setOpen(true);
            onQueryChange?.(q);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {shortcut && !query ? (
          <kbd aria-hidden="true" className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
            {shortcut}
          </kbd>
        ) : null}
      </div>
      {open ? (
        <CommandList
          label="Search results"
          className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[min(24rem,60dvh)] min-w-80 animate-in rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg duration-150 fade-in-0 slide-in-from-top-1"
        >
          <Results groups={groups} query={query} onDone={done} />
        </CommandList>
      ) : null}
    </CommandPrimitive>
  );
}

export function CommandPalette({ groups, placeholder = "Search clients, returns, invoices", onQueryChange, filter = true, open, onOpenChange }: SearchProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = React.useState("");
  const close = () => {
    onOpenChange(false);
    setQuery("");
    onQueryChange?.("");
  };
  return (
    <CommandDialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())} shouldFilter={filter}>
      <CommandInput
        value={query}
        onValueChange={(q) => {
          setQuery(q);
          onQueryChange?.(q);
        }}
        placeholder={placeholder}
      />
      <CommandList>
        <Results groups={groups} query={query} onDone={close} />
      </CommandList>
    </CommandDialog>
  );
}
