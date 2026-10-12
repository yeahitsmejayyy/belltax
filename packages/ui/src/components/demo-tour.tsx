import { ArrowRight, LayoutDashboard, Lightbulb, Smartphone, X } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";

// The hosted public demo's guide pieces (ticket 45). Shown only when the server says it's the public demo
// (demo.tour.publicDemo), never in live mode. A reviewer arriving cold should know what to do in five seconds.

/** The two ways in: one click to the client's portal or the tax agent's admin, with the full picker below. */
export function DemoFrontDoor({
  clientName,
  onClient,
  onAgent,
  onPickAny,
  resetHours = 6,
  className,
}: {
  clientName: string;
  onClient: () => void;
  onAgent: () => void;
  onPickAny?: () => void;
  resetHours?: number;
  className?: string;
}) {
  const first = clientName.split(" ")[0];
  return (
    <section data-slot="demo-front-door" aria-labelledby="demo-front-door-title" className={cn("grid gap-6", className)}>
      <div className="grid gap-2">
        <h1 id="demo-front-door-title" className="text-3xl font-semibold tracking-tight md:text-4xl">
          Try the demo
        </h1>
        <p className="text-muted-foreground">A tax practice's client portal and its back office, running on invented households. Pick a side.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <DoorButton
          icon={Smartphone}
          title="See it as a client"
          body={`${first}'s return is waiting on a few things: a document to send again, a letter to sign, open questions.`}
          onClick={onClient}
        />
        <DoorButton
          icon={LayoutDashboard}
          title="See it as the tax agent"
          body="Every return in one pipeline: review documents, answer the inbox, move returns forward."
          onClick={onAgent}
        />
      </div>
      <div className="grid gap-2 text-sm text-muted-foreground">
        {onPickAny ? (
          <button type="button" onClick={onPickAny} className="justify-self-start font-medium text-foreground underline underline-offset-4 hover:text-primary">
            Or pick any of the invented clients
          </button>
        ) : null}
        <p>Nothing here is real, uploads are off, and everything resets every {resetHours} hours.</p>
      </div>
    </section>
  );
}

function DoorButton({ icon: Icon, title, body, onClick }: { icon: typeof Smartphone; title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group grid min-h-40 content-start gap-3 rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="grid size-10 place-items-center rounded-lg bg-brand-subtle text-brand-subtle-foreground">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="flex items-center justify-between gap-2 font-heading text-xl font-bold tracking-tight">
        {title}
        <ArrowRight aria-hidden="true" className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </span>
      <span className="text-sm text-muted-foreground">{body}</span>
    </button>
  );
}

/** A slim strip across the top of every page in the public demo: what this is, and the other side's door. */
export function DemoBar({ viewingAs, onSwitch, className }: { viewingAs: "client" | "agent"; onSwitch: () => void; className?: string }) {
  return (
    <div data-slot="demo-bar" role="region" aria-label="Demo" className={cn("border-b bg-charcoal text-white", className)}>
      <div className="mx-auto flex min-h-10 max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 text-sm md:px-6">
        <span className="flex items-center gap-2 font-medium">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-chartreuse" />
          Public demo · invented data
        </span>
        <span className="hidden text-white/70 sm:inline">Viewing as {viewingAs === "client" ? "a client" : "the tax agent"}</span>
        <button
          type="button"
          onClick={onSwitch}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full font-medium text-chartreuse underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chartreuse"
        >
          {viewingAs === "client" ? "Switch to the tax agent" : "Switch to the client"}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export type TryThisItem = { id: string; label: string; detail?: string; href: string };

/**
 * Two or three things worth trying on this page, dismissible. The app supplies the link element (a router
 * Link) through renderLink, and remembers dismissal itself.
 */
export function TryThis({
  items,
  onDismiss,
  renderLink = (item, className, children) => (
    <a href={item.href} className={className}>
      {children}
    </a>
  ),
  className,
}: {
  items: TryThisItem[];
  onDismiss: () => void;
  renderLink?: (item: TryThisItem, className: string, children: React.ReactNode) => React.ReactNode;
  className?: string;
}) {
  return (
    <aside data-slot="try-this" aria-label="Try this" className={cn("relative grid gap-3 rounded-xl border border-dashed border-primary/60 bg-brand-subtle/40 p-4", className)}>
      <div className="flex items-center gap-2 pr-8 text-sm font-semibold">
        <Lightbulb aria-hidden="true" className="size-4 text-brand-subtle-foreground" />
        Try this
      </div>
      <Button variant="ghost" size="icon" className="absolute top-2 right-2 size-8" onClick={onDismiss} aria-label="Hide these tips">
        <X aria-hidden="true" className="size-4" />
      </Button>
      <ul className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {items.map((item) => (
          <li key={item.id}>
            {renderLink(
              item,
              "group grid h-full gap-0.5 rounded-lg bg-card px-3 py-2.5 text-sm ring-1 ring-border transition-colors hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              <>
                <span className="flex items-center justify-between gap-2 font-medium">
                  {item.label}
                  <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
                {item.detail ? <span className="text-muted-foreground">{item.detail}</span> : null}
              </>,
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
