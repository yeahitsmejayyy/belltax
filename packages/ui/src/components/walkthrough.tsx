import type { Stage } from "@app/schema";
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Download,
  FileText,
  Lock,
  Pause,
  PenLine,
  Play,
  ShieldCheck,
  Upload,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { Banner } from "./banner";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { BellMark, Logo } from "./logo";
import { Money } from "./money";
import { Progress } from "./progress";
import { StagePill } from "./stage-pill";
import { DocumentChip, InvoiceChip, StatusChip, type DocumentChipStatus } from "./status-chip";
import { cn } from "../utils";

// "How it works" on the marketing site (marketing 05 desktop, 16 phone): a list of steps beside a phone that plays a
// script through mini portal screens (portal mobile 01-02, 05, 13, 14, 17, 19). Everything it shows comes in as config:
// the steps and their beats (`WalkthroughStep[]`), every word and number on the screens (`WalkthroughPortal`, invented
// data) and the controls' labels. The component only plays it: one timer per beat, paused by the user, by hover or
// keyboard focus, off screen, and under reduced motion (then the visitor steps by hand).

// ---------- The script ----------

/** What the phone shows during a beat. */
export type WalkthroughView =
  | { screen: "invite" }
  | { screen: "password"; filled: boolean; pending?: boolean }
  | { screen: "home" }
  | { screen: "documents"; upload: "idle" | "uploading" | "done" }
  | { screen: "letter"; signed: boolean }
  | { screen: "invoice"; paid: "no" | "processing" | "yes"; saved?: boolean };

/** Elements in the screens carry `data-tap={target}` so the tap dot lands on them (`tab-<key>` for the bottom tabs). */
export type WalkthroughTapTarget = "setup" | "create" | "tab-home" | "tab-documents" | "tab-letter" | "tab-invoice" | "photo" | "sign" | "pay" | "receipt";

/** Show `view` for `ms`, then, if there's a `tap`, tap that target for TAP_MS. */
export type WalkthroughBeat = { view: WalkthroughView; ms: number; tap?: WalkthroughTapTarget };
/** One step in the list: its title and line, what the phone does (read to screen readers), and its beats. */
export type WalkthroughStep = { title: string; body: string; shows: string; beats: WalkthroughBeat[] };

/** How long a tap takes. */
export const TAP_MS = 700;

/** How long a step plays, taps included. */
export const stepDuration = (s: WalkthroughStep) => s.beats.reduce((t, b) => t + b.ms + (b.tap ? TAP_MS : 0), 0);

// ---------- The screens' content ----------

/** A to-do or requested document: its title, an optional line under it, and its chip ("unsigned" for the letter). */
export type WalkthroughItem = { title: string; detail?: string; status: DocumentChipStatus | "unsigned" };
/** Counts on the bottom tabs, by tab key. Zero or missing shows none. */
export type WalkthroughBadges = Partial<Record<string, number>>;

/** Every word and number the mini portal screens show. Invented sample data only (docs/two-data-worlds.md). */
export type WalkthroughPortal = {
  /** The portal header: its mode badge and the account initials. The bottom tabs: keys are the screens' names. */
  shell: { mode: string; initials: string; tabs: { key: string; label: string; icon: LucideIcon }[] };
  invite: { from: string; title: string; intro: string; emailLabel: string; email: string; action: string; note: string };
  password: {
    title: string;
    /** The line under the title, either side of the email. */
    intro: [before: string, after: string];
    email: string;
    fields: string[];
    /** What a filled field shows. */
    dots: string;
    rules: string[];
    action: string;
    pending: string;
  };
  home: {
    badges: WalkthroughBadges;
    greeting: string;
    returnLine: string;
    stage: Stage;
    stepLabel: string;
    progress: number;
    needsTitle: string;
    needsHint: string;
    unsigned: string;
    needs: WalkthroughItem[];
    action: string;
  };
  documents: {
    title: string;
    /** Before and after the upload: the summary line, the bottom-tab counts. */
    summary: { before: string; after: string };
    badges: { before: WalkthroughBadges; after: WalkthroughBadges };
    progress: number;
    toast: string;
    takePhoto: string;
    chooseFile: string;
    uploading: string;
    uploadProgress: number;
    tip: string;
    askedFor: string;
    requests: (WalkthroughItem & { status: DocumentChipStatus })[];
    /** Which request the upload fills (its chip turns Uploaded). */
    uploads: number;
  };
  letter: {
    badges: { unsigned: WalkthroughBadges; signed: WalkthroughBadges };
    toast: string;
    title: string;
    intro: string;
    heading: string;
    between: string;
    sectionTitle: string;
    section: string;
    signedTitle: string;
    signedNote: string;
    nameLabel: string;
    name: string;
    consent: string;
    action: string;
  };
  invoice: {
    badges: WalkthroughBadges;
    toast: string;
    title: string;
    meta: string;
    total: number;
    due: string;
    coversLabel: string;
    lines: { label: string; cents: number }[];
    totalLabel: string;
    paidNote: string;
    receipt: string;
    pay: string;
    processing: string;
    note: string;
  };
};

/** The section's own words: its heading, and the controls under the phone. */
export type WalkthroughCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  previous: string;
  next: string;
  play: string;
  pause: string;
  /** The line beside the controls, e.g. "Step 2 of 5 · See where things stand". */
  caption: (at: { step: number; of: number; title: string }) => string;
  /** What the live region says when the visitor moves to a step. */
  announce: (at: { step: number; of: number; title: string; shows: string }) => string;
};

// ---------- The player ----------

export type WalkthroughPos = { step: number; beat: number; phase: "show" | "tap" };

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useReducedMotion = () => React.useSyncExternalStore(subscribe, () => window.matchMedia(REDUCE).matches, () => false);

/**
 * Plays a script: one timer for the current beat (or its tap), which keeps its remaining time across pauses. It runs
 * only while the user hasn't paused, nothing is hovered or keyboard-focused, `sectionRef` is on screen, and reduced
 * motion is off.
 */
export function useWalkthrough(steps: WalkthroughStep[], sectionRef: React.RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();
  const [pos, setPos] = React.useState<WalkthroughPos>({ step: 0, beat: 0, phase: "show" });
  const [playing, setPlaying] = React.useState(true);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const running = playing && !hovered && !focused && visible && !reduced;

  const durationOf = React.useCallback((p: WalkthroughPos) => (p.phase === "tap" ? TAP_MS : (steps[p.step]?.beats[p.beat]?.ms ?? 0)), [steps]);
  const left = React.useRef(durationOf(pos));
  const started = React.useRef(0);

  const go = React.useCallback(
    (p: WalkthroughPos) => {
      left.current = durationOf(p);
      setPos(p);
    },
    [durationOf],
  );

  React.useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [sectionRef]);

  React.useEffect(() => {
    if (!running) return;
    let fired = false;
    started.current = performance.now();
    const id = window.setTimeout(() => {
      fired = true;
      const beats = steps[pos.step]!.beats;
      if (pos.phase === "show" && beats[pos.beat]!.tap) go({ ...pos, phase: "tap" });
      else if (pos.beat + 1 < beats.length) go({ step: pos.step, beat: pos.beat + 1, phase: "show" });
      else go({ step: (pos.step + 1) % steps.length, beat: 0, phase: "show" });
    }, left.current);
    return () => {
      window.clearTimeout(id);
      if (!fired) left.current = Math.max(0, left.current - (performance.now() - started.current));
    };
  }, [pos, running, steps, go]);

  // How far through the current step, 0..1, for the progress bar (read every frame, no re-render).
  const progress = React.useCallback(() => {
    const s = steps[pos.step]!;
    let done = 0;
    for (let i = 0; i < pos.beat; i++) done += s.beats[i]!.ms + (s.beats[i]!.tap ? TAP_MS : 0);
    if (pos.phase === "tap") done += s.beats[pos.beat]!.ms;
    const spent = durationOf(pos) - left.current + (running ? Math.min(left.current, performance.now() - started.current) : 0);
    const total = stepDuration(s);
    return total ? Math.min(1, (done + spent) / total) : 0;
  }, [steps, pos, running, durationOf]);

  const jump = React.useCallback(
    (step: number) => {
      go({ step: (step + steps.length) % steps.length, beat: 0, phase: "show" });
      setPlaying(true);
    },
    [go, steps.length],
  );

  return {
    pos,
    beat: steps[pos.step]!.beats[pos.beat]!,
    running,
    playing,
    reduced,
    progress,
    jump,
    togglePlay: () => setPlaying((p) => !p),
    setHovered,
    setFocused,
  };
}

/**
 * The whole "How it works" section: heading, the step list (it picks a step), the phone playing the script, and the
 * play/pause (or, under reduced motion, previous/next) controls.
 */
export function WalkthroughSection({ id = "how", steps, portal, copy }: { id?: string; steps: WalkthroughStep[]; portal: WalkthroughPortal; copy: WalkthroughCopy }) {
  const sectionRef = React.useRef<HTMLElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const w = useWalkthrough(steps, sectionRef);
  const step = steps[w.pos.step]!;
  const at = { step: w.pos.step + 1, of: steps.length, title: step.title };
  const titleId = `${id}-title`;

  return (
    <section id={id} ref={sectionRef} aria-labelledby={titleId} className="scroll-mt-18 px-4 py-14 md:px-8 md:py-22">
      <div className="mx-auto grid max-w-6xl gap-10">
        <div className="mx-auto grid max-w-xl justify-items-center gap-3 text-center">
          <p className="text-sm font-semibold text-primary">{copy.eyebrow}</p>
          <h2 id={titleId} className="text-[28px] leading-tight font-bold md:text-4xl">
            {copy.title}
          </h2>
          <p className="text-[17px] leading-relaxed text-muted-foreground">{copy.intro}</p>
        </div>

        <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16 lg:px-8">
          <ol
            className="grid gap-2"
            onFocus={(e) => w.setFocused(e.target.matches(":focus-visible"))}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) w.setFocused(false);
            }}
          >
            {steps.map((s, i) => {
              const on = i === w.pos.step;
              return (
                <li key={s.title}>
                  <button
                    type="button"
                    aria-current={on ? "step" : undefined}
                    onClick={() => w.jump(i)}
                    className={cn(
                      "flex w-full gap-4 rounded-xl border p-4 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      on ? "border-border bg-card shadow-xs" : "border-transparent",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                        on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="text-[17px] font-semibold">{s.title}</span>
                      <span className="text-[15px] leading-relaxed text-pretty text-muted-foreground">{s.body}</span>
                      {/* Reserved on every step so the list never changes height. */}
                      <span className={cn("mt-2 h-[3px] overflow-hidden rounded-full", on && !w.reduced ? "bg-border" : "bg-transparent")}>
                        {on && !w.reduced ? <StepProgress progress={w.progress} running={w.running} /> : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="grid justify-items-center gap-4">
            {/* Hovering the phone pauses it. The frame is inert (gets no pointer events), so the wrapper listens. */}
            <div
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") w.setHovered(true);
              }}
              onPointerLeave={() => w.setHovered(false)}
            >
              <WalkthroughPhone>
                <div ref={screenRef} className="absolute inset-0">
                  <ScreenStage key={w.beat.view.screen}>
                    <WalkthroughScreen view={w.beat.view} portal={portal} />
                  </ScreenStage>
                  {w.pos.phase === "tap" && w.beat.tap && !w.reduced ? <TapDot key={`${w.pos.step}-${w.pos.beat}`} target={w.beat.tap} screenRef={screenRef} /> : null}
                </div>
              </WalkthroughPhone>
            </div>

            <div className="flex min-h-11 flex-wrap items-center justify-center gap-2">
              {w.reduced ? (
                <>
                  <Button variant="outline" size="icon-touch" aria-label={copy.previous} onClick={() => w.jump(w.pos.step - 1)}>
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <Button variant="outline" size="icon-touch" aria-label={copy.next} onClick={() => w.jump(w.pos.step + 1)}>
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="touch" onClick={w.togglePlay}>
                  {w.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                  {w.playing ? copy.pause : copy.play}
                </Button>
              )}
              <span aria-hidden="true" className="text-sm text-muted-foreground">
                {copy.caption(at)}
              </span>
            </div>
            {/* Quiet while it plays by itself; speaks when the user is driving. */}
            <p className="sr-only" aria-live={w.running ? "off" : "polite"} aria-atomic="true">
              {copy.announce({ ...at, shows: step.shows })}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// The active step's bar, written straight to the DOM each frame while playing (no re-render per frame).
function StepProgress({ progress, running }: { progress: () => number; running: boolean }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const set = () => ref.current?.style.setProperty("transform", `scaleX(${progress()})`);
    set();
    if (!running) return;
    let raf = 0;
    const loop = () => {
      set();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [progress, running]);
  return <span ref={ref} className="block h-full origin-left rounded-full bg-primary" style={{ transform: "scaleX(0)" }} />;
}

// ---------- The phone and the tap ----------

/**
 * The phone the walkthrough plays in (marketing 05 / 16): a 390 × 844 screen drawn in CSS, scaled down with a
 * transform inside a box of fixed size, so it never shifts the layout. Decorative: inert and hidden from screen
 * readers (the section's live region says what it shows).
 */
export function WalkthroughPhone({ children, className, ...props }: React.ComponentProps<"div">) {
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

type Phase = "in" | "down" | "up";

/**
 * Shows where the walkthrough "taps": a dot fades in on the `[data-tap=target]` element inside `screenRef`, presses,
 * ripples and fades out. Placed in the screen's own (unscaled) coordinates; animates transform and opacity only.
 */
export function TapDot({ target, screenRef }: { target: string; screenRef: React.RefObject<HTMLDivElement | null> }) {
  const [at, setAt] = React.useState<{ x: number; y: number } | null>(null);
  const [phase, setPhase] = React.useState<Phase>("in");

  React.useLayoutEffect(() => {
    const screen = screenRef.current;
    const el = screen?.querySelector<HTMLElement>(`[data-tap="${target}"]`);
    if (!screen || !el) return setAt(null);
    const s = screen.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const k = s.width / screen.offsetWidth || 1;
    setAt({ x: (r.left - s.left + r.width / 2) / k, y: (r.top - s.top + r.height / 2) / k });
  }, [target, screenRef]);

  React.useEffect(() => {
    setPhase("in");
    const timers = [window.setTimeout(() => setPhase("down"), 280), window.setTimeout(() => setPhase("up"), 420)];
    return () => timers.forEach(clearTimeout);
  }, [target]);

  if (!at) return null;
  return (
    <div className="pointer-events-none absolute top-0 left-0 z-20" style={{ transform: `translate(${at.x}px, ${at.y}px)` }}>
      <span
        className={cn(
          "absolute -top-8 -left-8 size-16 rounded-full bg-primary/25 transition-[scale,opacity] duration-500 ease-enter",
          { in: "scale-50 opacity-0", down: "scale-100 opacity-100 duration-100", up: "scale-150 opacity-0" }[phase],
        )}
      />
      <span
        className={cn(
          "absolute -top-5 -left-5 size-10 rounded-full border-2 border-background bg-foreground/45 shadow-lg transition-[scale,opacity] duration-200 ease-standard starting:scale-125 starting:opacity-0",
          phase === "down" ? "scale-[0.8]" : "scale-100",
          phase === "up" && "opacity-0 delay-150",
        )}
      />
    </div>
  );
}

// ---------- The screens ----------

/** One mini portal screen at 390 × 844, in the state `view` asks for. Static: the script sets the state. */
export function WalkthroughScreen({ view, portal }: { view: WalkthroughView; portal: WalkthroughPortal }) {
  switch (view.screen) {
    case "invite":
      return <Invite portal={portal} />;
    case "password":
      return <Password portal={portal} filled={view.filled} pending={!!view.pending} />;
    case "home":
      return <Home portal={portal} />;
    case "documents":
      return <Documents portal={portal} upload={view.upload} />;
    case "letter":
      return <Letter portal={portal} signed={view.signed} />;
    case "invoice":
      return <Invoice portal={portal} paid={view.paid} saved={!!view.saved} />;
  }
}

/** The screen's root. Key it by screen so a new screen rises in (btp-page: transform + opacity). */
export function ScreenStage({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 animate-page">{children}</div>;
}

type P = { portal: WalkthroughPortal };

function Invite({ portal }: P) {
  const c = portal.invite;
  return (
    <div className="grid gap-6 px-6 pt-24">
      <BellMark className="size-12 justify-self-start" />
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">{c.from}</p>
        <h1 className="text-3xl font-bold">{c.title}</h1>
        <p className="text-muted-foreground">{c.intro}</p>
      </div>
      <div className="grid gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">{c.emailLabel}</p>
          <p className="font-medium">{c.email}</p>
        </div>
        <Button size="touch" tabIndex={-1} data-tap="setup">
          {c.action}
        </Button>
      </div>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {c.note}
      </p>
    </div>
  );
}

function Password({ portal, filled, pending }: P & { filled: boolean; pending: boolean }) {
  const c = portal.password;
  const dots = filled ? c.dots : "";
  return (
    <div className="grid gap-6 px-6 pt-24">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold">{c.title}</h1>
        <p className="text-muted-foreground">
          {c.intro[0]}<span className="text-foreground">{c.email}</span>{c.intro[1]}
        </p>
      </div>
      <div className="grid gap-4">
        {c.fields.map((label) => (
          <div key={label} className="grid gap-2">
            <span className="text-sm font-medium">{label}</span>
            <Input readOnly tabIndex={-1} value={dots} className="h-11 text-base tracking-widest" />
          </div>
        ))}
        <ul className="grid gap-2 text-sm">
          {c.rules.map((r) => (
            <li key={r} className={cn("flex items-center gap-2", filled ? "text-success-foreground" : "text-muted-foreground")}>
              {filled ? <Check aria-hidden="true" className="size-4" /> : <CircleDashed aria-hidden="true" className="size-4" />}
              <span className="text-foreground">{r}</span>
            </li>
          ))}
        </ul>
        <Button size="touch" tabIndex={-1} data-tap="create" disabled={pending} className="disabled:opacity-70">
          {pending ? c.pending : c.action}
        </Button>
      </div>
    </div>
  );
}

// The portal shell: header, a clipped page, the bottom tabs.
function Shell({ portal, tab, badges, toast, children }: P & { tab: string; badges: WalkthroughBadges; toast?: string; children: React.ReactNode }) {
  const c = portal.shell;
  return (
    <>
      <header className="absolute inset-x-0 top-14 flex h-16 items-center gap-3 border-b px-5">
        <Logo />
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-mode-demo px-2.5 text-xs font-semibold text-mode-demo-foreground">
          <span className="size-1.5 rounded-full bg-current" />
          {c.mode}
        </span>
        <span className="ml-auto flex size-10 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand-subtle-foreground">
          {c.initials}
        </span>
      </header>
      {toast ? (
        <div className="absolute inset-x-0 top-32 z-10 flex justify-center px-5">
          <div className="flex animate-page items-center gap-2 rounded-lg border bg-popover px-4 py-3 text-sm font-medium text-popover-foreground shadow-lg">
            <CheckCircle2 aria-hidden="true" className="size-4 text-success-foreground" />
            {toast}
          </div>
        </div>
      ) : null}
      <div className="absolute inset-x-0 top-[120px] bottom-[88px] overflow-hidden px-5 pt-6">{children}</div>
      <nav className="absolute inset-x-0 bottom-0 grid h-[88px] grid-cols-5 border-t bg-background pb-5">
        {c.tabs.map((t) => {
          const on = t.key === tab;
          return (
            <span
              key={t.key}
              data-tap={`tab-${t.key}`}
              className={cn("flex flex-col items-center justify-center gap-1 text-xs font-medium", on ? "font-semibold text-foreground" : "text-muted-foreground")}
            >
              <span className={cn("relative rounded-full px-4 py-1", on && "bg-brand-subtle text-brand-subtle-foreground")}>
                <t.icon aria-hidden="true" className="size-5" />
                {badges[t.key] ? (
                  <span className="absolute -top-1.5 right-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums">
                    {badges[t.key]}
                  </span>
                ) : null}
              </span>
              {t.label}
            </span>
          );
        })}
      </nav>
    </>
  );
}

const PageTitle = ({ children }: { children: React.ReactNode }) => <h1 className="text-3xl font-bold">{children}</h1>;

function Home({ portal }: P) {
  const c = portal.home;
  return (
    <Shell portal={portal} tab="home" badges={c.badges}>
      <div className="grid gap-5">
        <div className="grid gap-2">
          <PageTitle>{c.greeting}</PageTitle>
          <p className="text-muted-foreground">
            {c.returnLine}
          </p>
          <div className="flex items-center gap-3">
            <StagePill stage={c.stage} />
            <span className="text-sm text-muted-foreground">{c.stepLabel}</span>
          </div>
          <Progress value={c.progress} className="mt-1 h-1.5" />
        </div>
        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-lg">{c.needsTitle}</CardTitle>
            <CardDescription>{c.needsHint}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 px-5">
            <ul className="divide-y rounded-lg border">
              {c.needs.map((n) => (
                <li key={n.title} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid flex-1 justify-items-start gap-1.5">
                    <span className="font-medium">{n.title}</span>
                    {n.status === "unsigned" ? <StatusChip tone="neutral" icon={CircleDashed} label={c.unsigned} /> : <DocumentChip status={n.status} />}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </li>
              ))}
            </ul>
            <Button size="touch" tabIndex={-1}>
              {c.action}
            </Button>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function Documents({ portal, upload }: P & { upload: "idle" | "uploading" | "done" }) {
  const c = portal.documents;
  const done = upload === "done";
  return (
    <Shell portal={portal} tab="documents" badges={done ? c.badges.after : c.badges.before} toast={done ? c.toast : undefined}>
      <div className="grid gap-5">
        <div className="grid gap-2">
          <PageTitle>{c.title}</PageTitle>
          <p className="text-muted-foreground">
            {done ? c.summary.after : c.summary.before}
          </p>
          <Progress value={c.progress} className="h-1.5 [&>*]:bg-success" />
        </div>
        <div className="grid gap-3 rounded-xl border border-dashed p-4">
          <Button size="touch" tabIndex={-1} data-tap="photo">
            <Camera aria-hidden="true" />
            {c.takePhoto}
          </Button>
          <Button size="touch" variant="outline" tabIndex={-1}>
            <Upload aria-hidden="true" />
            {c.chooseFile}
          </Button>
          {upload === "uploading" ? (
            <div className="grid gap-2 pt-1">
              <span className="text-sm text-muted-foreground">{c.uploading}</span>
              <Progress value={c.uploadProgress} className="h-1.5" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{c.tip}</p>
          )}
        </div>
        <div className="grid gap-3">
          <h2 className="text-sm text-muted-foreground">{c.askedFor}</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {c.requests.map((r, i) => (
              <li key={r.title} className="flex items-start gap-3 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileText aria-hidden="true" className="size-5" />
                </span>
                <span className="grid flex-1 justify-items-start gap-1">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-sm text-muted-foreground">{r.detail}</span>
                  <DocumentChip status={i === c.uploads && done ? "uploaded" : r.status} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Shell>
  );
}

function Letter({ portal, signed }: P & { signed: boolean }) {
  const c = portal.letter;
  return (
    <Shell portal={portal} tab="letter" badges={signed ? c.badges.signed : c.badges.unsigned} toast={signed ? c.toast : undefined}>
      <div className="grid gap-5">
        <div className="grid gap-2">
          <PageTitle>{c.title}</PageTitle>
          <p className="text-muted-foreground">{c.intro}</p>
        </div>
        <div className="grid h-52 content-start gap-3 overflow-hidden rounded-xl border bg-card p-5 text-sm">
          <h2 className="text-base font-semibold">{c.heading}</h2>
          <p className="text-muted-foreground">
            {c.between}
          </p>
          <h3 className="font-semibold">{c.sectionTitle}</h3>
          <p>{c.section}</p>
        </div>
        {signed ? (
          <Banner tone="success" title={c.signedTitle}>
            {c.signedNote}
          </Banner>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <span className="text-sm font-medium">{c.nameLabel}</span>
              <Input readOnly tabIndex={-1} value={c.name} className="h-11 text-base" />
            </div>
            <div className="flex items-start gap-3 text-sm">
              <Checkbox checked tabIndex={-1} className="mt-0.5" />
              <span>{c.consent}</span>
            </div>
            <Button size="touch" tabIndex={-1} data-tap="sign">
              <PenLine aria-hidden="true" />
              {c.action}
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Invoice({ portal, paid, saved }: P & { paid: "no" | "processing" | "yes"; saved: boolean }) {
  const c = portal.invoice;
  return (
    <Shell portal={portal} tab="invoice" badges={c.badges} toast={saved ? c.toast : undefined}>
      <div className="grid gap-5">
        <PageTitle>{c.title}</PageTitle>
        <Card className="gap-5 px-5 py-6">
          <p className="text-sm text-muted-foreground">
            {c.meta}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Money cents={c.total} className="text-4xl font-bold tracking-tight" />
            {paid === "yes" ? <InvoiceChip status="paid" /> : <StatusChip tone="neutral" icon={CircleDashed} label={c.due} />}
          </div>
          <div className="grid gap-3 text-sm">
            <span className="text-muted-foreground">{c.coversLabel}</span>
            {c.lines.map((l) => (
              <div key={l.label} className="flex justify-between gap-4">
                <span>{l.label}</span>
                <Money cents={l.cents} />
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t pt-3 font-semibold">
              <span>{c.totalLabel}</span>
              <Money cents={c.total} />
            </div>
          </div>
          {paid === "yes" ? (
            <>
              <div className="flex items-start gap-3 rounded-lg bg-success-subtle p-4 text-sm text-success-foreground">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {c.paidNote}
              </div>
              <Button size="touch" variant="outline" tabIndex={-1} data-tap="receipt">
                <Download aria-hidden="true" />
                {c.receipt}
              </Button>
            </>
          ) : (
            <>
              <Button size="touch" tabIndex={-1} data-tap="pay" disabled={paid === "processing"} className="disabled:opacity-70">
                {paid === "processing" ? (
                  c.processing
                ) : (
                  <>
                    {c.pay} <Money cents={c.total} />
                  </>
                )}
              </Button>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {c.note}
              </p>
            </>
          )}
        </Card>
      </div>
    </Shell>
  );
}
