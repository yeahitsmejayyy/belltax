import * as React from "react";

import type { Answers, SaveState } from "@app/ui/components/intake";

import { trpc } from "@/lib/trpc";

// Answers save themselves as a draft: changes collect for a moment, then go to intake.save without
// submit (the server merges them over what's there, and drops the ones emptied). Saves run one at a time, in order, and whatever
// is waiting goes when the page is hidden or left.

export function useAutosave(engagementId: string | undefined, delay = 800) {
  const utils = trpc.useUtils();
  const pending = React.useRef<Answers>({});
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = React.useRef<Promise<void>>(Promise.resolve());
  const [state, setState] = React.useState<SaveState>({ status: "idle" });

  const flush = React.useCallback(() => {
    clearTimeout(timer.current);
    chain.current = chain.current.then(async () => {
      // An emptied question (undefined) is cleared on the server, not left at its old answer.
      const entries = Object.entries(pending.current);
      const answers = Object.fromEntries(entries.filter(([, v]) => v !== undefined));
      const clear = entries.filter(([, v]) => v === undefined).map(([k]) => k);
      const sent = pending.current;
      pending.current = {};
      if (!engagementId || !entries.length) return;
      setState({ status: "saving" });
      try {
        const view = await utils.client.intake.save.mutate({ engagementId, answers, clear });
        utils.intake.get.setData({ engagementId }, view);
        setState({ status: "saved", at: new Date() });
      } catch (e) {
        pending.current = { ...sent, ...pending.current };
        setState({ status: "error" });
        // Sent from another device, or the return moved on: reload so the page turns read-only.
        if ((e as { data?: { code?: string } }).data?.code === "PRECONDITION_FAILED") {
          void utils.intake.get.invalidate({ engagementId });
          void utils.engagement.mine.invalidate();
        }
      }
    });
    return chain.current;
  }, [engagementId, utils]);

  const queue = React.useCallback(
    (patch: Answers) => {
      Object.assign(pending.current, patch);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush, delay],
  );

  React.useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  return { state, queue, flush };
}
