import type { EfileJurisdiction, EfileState } from "@app/schema";
import { AlertCircle, CheckCircle2, CircleDashed, Clock } from "lucide-react";
import * as React from "react";

import { formatDateTime } from "../format";
import { Banner } from "./banner";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Field, useFieldValidation } from "./field";
import { Label } from "./label";
import { StatusChip } from "./status-chip";
import { Textarea } from "./textarea";

// E-file, once a return is filed (admin 12-return-overview), the card apps/admin renders and Storybook shows (ticket 59):
// federal to the IRS, state to the FTB. The preparer records what each said. A rejection needs its code and what it
// means (EfileRejectDialog); then it can be submitted again. Recording goes out through the callbacks; the app sends it.

export const EFILE_WHERE: Record<EfileJurisdiction, string> = { federal: "Federal · IRS", state: "California · FTB" };
export const EFILE_STATUS: Record<NonNullable<EfileState["status"]> | "none", Pick<React.ComponentProps<typeof StatusChip>, "tone" | "icon" | "label">> = {
  none: { tone: "neutral", icon: CircleDashed, label: "Not e-filed" },
  submitted: { tone: "info", icon: Clock, label: "Waiting for an answer" },
  accepted: { tone: "success", icon: CheckCircle2, label: "Accepted" },
  rejected: { tone: "danger", icon: AlertCircle, label: "Rejected" },
};

/** A rejection as the preparer records it: the code and what it means, both trimmed. */
export type EfileRejection = { rejectionCode: string; reason: string };

/** Resolves with nothing once recorded, or with why it wasn't (shown in the dialog, which stays open). */
export type RecordRejection = (jurisdiction: EfileJurisdiction, rejection: EfileRejection) => Promise<string | null | void>;

const need = (what: string) => (v: string) => (v.trim().length ? null : `Enter ${what}.`);

/** Recording a rejection: open while `jurisdiction` is set. */
export function EfileRejectDialog({ jurisdiction, onRecord, onClose }: { jurisdiction: EfileJurisdiction | null; onRecord: RecordRejection; onClose: () => void }) {
  const code = useFieldValidation(React.useCallback(need("the rejection code"), []));
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const checkReason = (v: string) => {
    const m = v.trim().length >= 3 ? null : "Say what the rejection means, in a few words.";
    setReasonError(m);
    return !m;
  };

  React.useEffect(() => {
    if (jurisdiction) {
      code.setValue("");
      setReason("");
      setReasonError(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jurisdiction]);

  const submit = async () => {
    const ok = [code.validateNow(), checkReason(reason)].every(Boolean);
    if (!ok || !jurisdiction) return;
    setError(null);
    setPending(true);
    try {
      const failed = await onRecord(jurisdiction, { rejectionCode: code.value.trim(), reason: reason.trim() });
      if (failed) setError(failed);
      else onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={!!jurisdiction} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a {jurisdiction === "state" ? "state" : "federal"} rejection</DialogTitle>
          <DialogDescription>The code stays in the admin. The client only hears that it needs another look.</DialogDescription>
        </DialogHeader>
        <Field label="Rejection code" placeholder="IND-031-04" autoFocus error={code.error} {...code.inputProps} />
        <div className="grid gap-1.5">
          <Label htmlFor="efile-reason">What it means</Label>
          <Textarea
            id="efile-reason"
            value={reason}
            aria-invalid={reasonError ? true : undefined}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) checkReason(e.target.value);
            }}
            onBlur={() => checkReason(reason)}
            placeholder="Prior-year AGI doesn't match the IRS's records."
          />
          {reasonError ? (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-danger-foreground">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {reasonError}
            </p>
          ) : null}
        </div>
        {error ? <Banner tone="danger" title="It wasn't recorded">{error}</Banner> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            Record rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type EfileCardProps = {
  /** One per jurisdiction, as the server returns them. */
  filings: readonly EfileState[];
  /** Whether answers can be recorded (the return is Filed, not yet Complete). */
  canRecord: boolean;
  /** While a submit or accept is being sent. */
  pending?: boolean;
  onSubmit: (jurisdiction: EfileJurisdiction) => void;
  onAccept: (jurisdiction: EfileJurisdiction) => void;
  onReject: RecordRejection;
};

/** Each jurisdiction's latest e-file: its state, when, the attempt, a rejection's code, and what can be recorded next. */
export function EfileCard({ filings, canRecord, pending = false, onSubmit, onAccept, onReject }: EfileCardProps) {
  const [rejecting, setRejecting] = React.useState<EfileJurisdiction | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>E-file</CardTitle>
        <CardDescription>Record what the IRS and the FTB said. Complete needs both accepted.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {filings.map((e) => {
          const s = EFILE_STATUS[e.status ?? "none"];
          return (
            <div key={e.jurisdiction} className="grid gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{EFILE_WHERE[e.jurisdiction]}</span>
                <StatusChip {...s} />
              </div>
              <p className="text-xs text-muted-foreground">
                {e.decidedAt ? `Answered ${formatDateTime(e.decidedAt)}` : e.submittedAt ? `Submitted ${formatDateTime(e.submittedAt)}` : "Not submitted yet"}
                {e.attempts > 1 ? ` · attempt ${e.attempts}` : ""}
              </p>
              {e.status === "rejected" ? (
                <p className="text-sm">
                  <span className="font-mono">{e.rejectionCode}</span>
                  {e.rejectionNote ? ` · ${e.rejectionNote}` : ""}
                </p>
              ) : null}
              {canRecord ? (
                <div className="flex flex-wrap gap-2">
                  {e.status === "submitted" ? (
                    <>
                      <Button variant="outline" size="sm" className="max-md:h-11" disabled={pending} onClick={() => onAccept(e.jurisdiction)}>
                        Record accepted
                      </Button>
                      <Button variant="outline" size="sm" className="max-md:h-11" disabled={pending} onClick={() => setRejecting(e.jurisdiction)}>
                        Record rejected…
                      </Button>
                    </>
                  ) : e.status !== "accepted" ? (
                    <Button variant="outline" size="sm" className="max-md:h-11" disabled={pending} onClick={() => onSubmit(e.jurisdiction)}>
                      {e.status === "rejected" ? "Submit again" : "Record submitted"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
      <EfileRejectDialog jurisdiction={rejecting} onRecord={onReject} onClose={() => setRejecting(null)} />
    </Card>
  );
}
