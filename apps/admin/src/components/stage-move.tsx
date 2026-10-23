import type { Stage } from "@app/schema";
import * as React from "react";
import { toast } from "sonner";

import { moveDirection, StageMoveDialog } from "@app/ui/components/stage-move-dialog";

import { stageLabel } from "@/lib/labels";
import { trpc } from "@/lib/trpc";

// Moving a return between stages (admin 19-dialogs-and-sheets-dlg-advance, 20-dlg-back). Forward asks to confirm
// and shows what blocks it, in the server's words; backward always asks why, and the reason is logged. Used by
// the pipeline (drag, menu) and the return page (its primary action). The dialog is StageMoveDialog from the design
// system; this hook holds the move and does the mutation, the toasts and the Undo.
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

  const { backward } = moveDirection(move);

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
    <StageMoveDialog move={move} reason={reason} onReasonChange={setReason} error={error} pending={advance.isPending} onCancel={() => close(false)} onConfirm={confirm} />
  );

  return { request, advanceNow, dialog };
}
