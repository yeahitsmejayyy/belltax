import type { Stage } from "@app/schema";
import { Stage as Stages } from "@app/schema";
import * as React from "react";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@app/ui/components/dialog";
import { Label } from "@app/ui/components/label";
import { StagePill } from "@app/ui/components/stage-pill";
import { Textarea } from "@app/ui/components/textarea";

import { stageLabel } from "@/lib/labels";
import { trpc } from "@/lib/trpc";

// Moving a return between stages (admin 19-dialogs-and-sheets-dlg-advance, 20-dlg-back). Forward asks to confirm
// and shows what blocks it, in the server's words; backward always asks why, and the reason is logged. Used by
// the pipeline (drag, menu) and the return page (its primary action).
//
// On the board a forward drop doesn't ask: `advanceNow` moves it, says so with an Undo, and resolves false if
// the server refuses (the gate's own words in the toast) so the card goes back. `request` resolves too: true
// once confirmed, false if the dialog is cancelled.

type Move = { engagementId: string; name: string; from: Stage; to: Stage };

export function useStageMove() {
  const [move, setMove] = React.useState<Move | null>(null);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const settle = React.useRef<((moved: boolean) => void) | null>(null);
  const utils = trpc.useUtils();
  const advance = trpc.engagement.advanceStage.useMutation();

  const backward = move ? Stages.options.indexOf(move.to) < Stages.options.indexOf(move.from) : false;
  const skip = move ? Math.abs(Stages.options.indexOf(move.to) - Stages.options.indexOf(move.from)) > 1 && !backward : false;

  const close = (moved: boolean) => {
    settle.current?.(moved);
    settle.current = null;
    setMove(null);
  };

  const request = React.useCallback((m: Move) => {
    settle.current?.(false);
    setMove(m);
    setReason("");
    setError(null);
    return new Promise<boolean>((resolve) => {
      settle.current = resolve;
    });
  }, []);

  const advanceNow = React.useCallback(
    async (m: Move) => {
      try {
        await advance.mutateAsync({ engagementId: m.engagementId, to: m.to });
        await utils.invalidate();
        toast.success(`${m.name} moved to ${stageLabel(m.to)}`, {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await advance.mutateAsync({ engagementId: m.engagementId, to: m.from, reason: "Undone: moved by mistake." });
                await utils.invalidate();
                toast(`${m.name} is back in ${stageLabel(m.from)}`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "That couldn't be undone.");
              }
            },
          },
        });
        return true;
      } catch (e) {
        toast.error(`${m.name} can't move to ${stageLabel(m.to)} yet`, { description: e instanceof Error ? e.message : undefined });
        return false;
      }
    },
    [advance, utils],
  );

  const confirm = async () => {
    if (!move) return;
    setError(null);
    try {
      await advance.mutateAsync({ engagementId: move.engagementId, to: move.to, ...(backward ? { reason: reason.trim() } : {}) });
      await utils.invalidate();
      toast.success(`${move.name} moved to ${stageLabel(move.to)}`);
      close(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through.");
    }
  };

  const dialog = (
    <Dialog open={!!move} onOpenChange={(o) => !o && !advance.isPending && close(false)}>
      {move ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{backward ? `Move back to ${stageLabel(move.to)}?` : `Advance to ${stageLabel(move.to)}?`}</DialogTitle>
            <DialogDescription>
              {move.name}: <StagePill stage={move.from} className="mx-1 align-middle" /> → <StagePill stage={move.to} className="ml-1 align-middle" />
            </DialogDescription>
          </DialogHeader>
          {backward ? (
            <div className="grid gap-1.5">
              <Label htmlFor="move-reason">Why is it moving back?</Label>
              <Textarea id="move-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="A corrected 1099 is on its way." />
              <p className="text-xs text-muted-foreground">Required. It's logged on the return.</p>
            </div>
          ) : skip ? (
            <Banner tone="warning" title="Returns move one stage at a time">
              Next for this return is {stageLabel(Stages.options[Stages.options.indexOf(move.from) + 1]!)}.
            </Banner>
          ) : (
            <p className="text-sm text-muted-foreground">
              {move.to === "filed"
                ? "This records the federal and state e-files as waiting on the IRS and the FTB."
                : "The client's portal shows the new stage straight away."}
            </p>
          )}
          {error ? <Banner tone="danger" title="It can't move yet">{error}</Banner> : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => close(false)} disabled={advance.isPending}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={advance.isPending || skip || (backward && reason.trim().length < 3)}>
              {backward ? "Move back" : `Advance to ${stageLabel(move.to)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );

  return { request, advanceNow, dialog };
}
