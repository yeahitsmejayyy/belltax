import { Stage } from "@app/schema";

import { Banner } from "./banner";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Label } from "./label";
import { STAGE_META, StagePill } from "./stage-pill";
import { Textarea } from "./textarea";

// Moving a return between stages (admin 19-dialogs-and-sheets-dlg-advance, 20-dlg-back). Forward asks to confirm
// and shows what blocks it, in the server's words; backward always asks why, and the reason is logged. Used by
// the pipeline (drag, menu) and the return page (its primary action).
//
// Controlled: the app holds the move, the reason and the server's error, and does the mutation in `onConfirm`.

/** The return being moved: its name as shown, and the stage it's in and the one it's going to. */
export type StageMoveDraft = { name: string; from: Stage; to: Stage };

const label = (s: Stage) => STAGE_META[s].label;

/** Which way a move goes: back to an earlier stage, or forward past the next one (which isn't allowed). */
export function moveDirection(move: Pick<StageMoveDraft, "from" | "to"> | null) {
  const backward = move ? Stage.options.indexOf(move.to) < Stage.options.indexOf(move.from) : false;
  const skip = move ? Math.abs(Stage.options.indexOf(move.to) - Stage.options.indexOf(move.from)) > 1 && !backward : false;
  return { backward, skip };
}

/** The shortest reason a backward move accepts. */
export const MIN_REASON = 3;

export type StageMoveDialogProps = {
  /** The move being asked about; null keeps the dialog closed. */
  move: StageMoveDraft | null;
  /** Why it's moving back (backward moves only). */
  reason: string;
  onReasonChange: (reason: string) => void;
  /** The server's words when it refused, shown in a danger banner. */
  error?: string | null;
  /** The move is being sent: the buttons wait and the dialog can't be dismissed. */
  pending?: boolean;
  /** Cancel, Escape or a click outside (not while pending). */
  onCancel: () => void;
  onConfirm: () => void;
};

export function StageMoveDialog({ move, reason, onReasonChange, error, pending = false, onCancel, onConfirm }: StageMoveDialogProps) {
  const { backward, skip } = moveDirection(move);
  return (
    <Dialog open={!!move} onOpenChange={(o) => !o && !pending && onCancel()}>
      {move ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{backward ? `Move back to ${label(move.to)}?` : `Advance to ${label(move.to)}?`}</DialogTitle>
            <DialogDescription>
              {move.name}: <StagePill stage={move.from} className="mx-1 align-middle" /> → <StagePill stage={move.to} className="ml-1 align-middle" />
            </DialogDescription>
          </DialogHeader>
          {backward ? (
            <div className="grid gap-1.5">
              <Label htmlFor="move-reason">Why is it moving back?</Label>
              <Textarea id="move-reason" autoFocus value={reason} onChange={(e) => onReasonChange(e.target.value)} placeholder="A corrected 1099 is on its way." />
              <p className="text-xs text-muted-foreground">Required. It's logged on the return.</p>
            </div>
          ) : skip ? (
            <Banner tone="warning" title="Returns move one stage at a time">
              Next for this return is {label(Stage.options[Stage.options.indexOf(move.from) + 1]!)}.
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
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={pending || skip || (backward && reason.trim().length < MIN_REASON)}>
              {backward ? "Move back" : `Advance to ${label(move.to)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
