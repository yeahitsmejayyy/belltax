import { Button } from "@app/ui/components/button";
import { cn } from "@app/ui/utils";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import * as React from "react";

import { PhoneFrame } from "@/components/walkthrough/phone-frame";
import { PhoneScreen, ScreenStage } from "@/components/walkthrough/screens";
import { buildSteps } from "@/components/walkthrough/script";
import { TapDot } from "@/components/walkthrough/tap-dot";
import { useWalkthrough } from "@/components/walkthrough/use-walkthrough";
import { useNames } from "@/lib/public";

// How it works (marketing 05 desktop, 16 phone): five steps beside a phone that plays through the portal.
// The list picks a step; the phone is a scripted walkthrough with invented data.

export function How() {
  const names = useNames();
  const steps = React.useMemo(() => buildSteps(names.preparerFirst), [names.preparerFirst]);
  const sectionRef = React.useRef<HTMLElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const w = useWalkthrough(steps, sectionRef);
  const step = steps[w.pos.step]!;
  const caption = `Step ${w.pos.step + 1} of ${steps.length} · ${step.title}`;

  return (
    <section id="how" ref={sectionRef} aria-labelledby="how-title" className="scroll-mt-18 px-4 py-14 md:px-8 md:py-22">
      <div className="mx-auto grid max-w-6xl gap-10">
        <div className="mx-auto grid max-w-xl justify-items-center gap-3 text-center">
          <p className="text-sm font-semibold text-primary">How it works</p>
          <h2 id="how-title" className="text-[28px] leading-tight font-bold md:text-4xl">
            Five steps, all from your&nbsp;phone
          </h2>
          <p className="text-[17px] leading-relaxed text-muted-foreground">This is the portal, with sample data. Watch it play, or pick a&nbsp;step.</p>
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
              <PhoneFrame>
                <div ref={screenRef} className="absolute inset-0">
                  <ScreenStage key={w.beat.view.screen}>
                    <PhoneScreen view={w.beat.view} names={names} />
                  </ScreenStage>
                  {w.pos.phase === "tap" && w.beat.tap && !w.reduced ? <TapDot key={`${w.pos.step}-${w.pos.beat}`} target={w.beat.tap} screenRef={screenRef} /> : null}
                </div>
              </PhoneFrame>
            </div>

            <div className="flex min-h-11 flex-wrap items-center justify-center gap-2">
              {w.reduced ? (
                <>
                  <Button variant="outline" size="icon-touch" aria-label="Previous step" onClick={() => w.jump(w.pos.step - 1)}>
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <Button variant="outline" size="icon-touch" aria-label="Next step" onClick={() => w.jump(w.pos.step + 1)}>
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="touch" onClick={w.togglePlay}>
                  {w.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                  {w.playing ? "Pause" : "Play"}
                </Button>
              )}
              <span aria-hidden="true" className="text-sm text-muted-foreground">
                {caption}
              </span>
            </div>
            {/* Quiet while it plays by itself; speaks when the user is driving. */}
            <p className="sr-only" aria-live={w.running ? "off" : "polite"} aria-atomic="true">
              {`Step ${w.pos.step + 1} of ${steps.length}: ${step.title}. ${step.shows}`}
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
