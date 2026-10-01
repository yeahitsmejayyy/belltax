import * as React from "react";

import { TAP_MS, type Step } from "./script";

// Plays the script: one timer for the current beat (or its tap), which keeps its remaining time across pauses.
// It runs only while the user hasn't paused, nothing is hovered or keyboard-focused, the section is on screen,
// and reduced motion is off (then the user steps manually).

export type Pos = { step: number; beat: number; phase: "show" | "tap" };

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useReducedMotion = () => React.useSyncExternalStore(subscribe, () => window.matchMedia(REDUCE).matches, () => false);

export function useWalkthrough(steps: Step[], sectionRef: React.RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();
  const [pos, setPos] = React.useState<Pos>({ step: 0, beat: 0, phase: "show" });
  const [playing, setPlaying] = React.useState(true);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const running = playing && !hovered && !focused && visible && !reduced;

  const durationOf = React.useCallback((p: Pos) => (p.phase === "tap" ? TAP_MS : (steps[p.step]?.beats[p.beat]?.ms ?? 0)), [steps]);
  const left = React.useRef(durationOf(pos));
  const started = React.useRef(0);

  const go = React.useCallback(
    (p: Pos) => {
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
    const total = s.beats.reduce((t, b) => t + b.ms + (b.tap ? TAP_MS : 0), 0);
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
