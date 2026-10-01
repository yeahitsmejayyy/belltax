import { AlertCircle, CheckCircle2, CircleDashed, Clock } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@app/ui/components/dialog";
import { Field, useFieldValidation } from "@app/ui/components/field";
import { Label } from "@app/ui/components/label";
import { StatusChip } from "@app/ui/components/status-chip";
import { Textarea } from "@app/ui/components/textarea";
import { formatDateTime } from "@app/ui/format";

import { trpc } from "@/lib/trpc";

import { errorText, type Detail } from "./shared";

// E-file, once a return is filed (admin 12-return-overview): federal to the IRS, state to the FTB. The preparer
// records what each said. A rejection needs its code and what it means; then it can be submitted again.

type Efile = Detail["efile"][number];
const WHERE: Record<Efile["jurisdiction"], string> = { federal: "Federal · IRS", state: "California · FTB" };
const STATUS: Record<NonNullable<Efile["status"]> | "none", Pick<React.ComponentProps<typeof StatusChip>, "tone" | "icon" | "label">> = {
  none: { tone: "neutral", icon: CircleDashed, label: "Not e-filed" },
  submitted: { tone: "info", icon: Clock, label: "Waiting for an answer" },
  accepted: { tone: "success", icon: CheckCircle2, label: "Accepted" },
  rejected: { tone: "danger", icon: AlertCircle, label: "Rejected" },
};

const need = (what: string) => (v: string) => (v.trim().length ? null : `Enter ${what}.`);

function RejectDialog({ d, jurisdiction, onClose }: { d: Detail; jurisdiction: Efile["jurisdiction"] | null; onClose: () => void }) {
  const code = useFieldValidation(React.useCallback(need("the rejection code"), []));
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const utils = trpc.useUtils();
  const record = trpc.engagement.recordEfile.useMutation();
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
    try {
      await record.mutateAsync({ engagementId: d.engagementId, jurisdiction, action: "reject", rejectionCode: code.value.trim(), reason: reason.trim() });
      await utils.invalidate();
      toast.success(`${jurisdiction === "federal" ? "Federal" : "State"} rejection recorded`);
      onClose();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Dialog open={!!jurisdiction} onOpenChange={(o) => !o && !record.isPending && onClose()}>
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
          <Button variant="ghost" onClick={onClose} disabled={record.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={record.isPending}>
            Record rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EfileCard({ d }: { d: Detail }) {
  const [rejecting, setRejecting] = React.useState<Efile["jurisdiction"] | null>(null);
  const utils = trpc.useUtils();
  const record = trpc.engagement.recordEfile.useMutation();
  const canRecord = d.stage === "filed";

  const act = async (e: Efile, action: "submit" | "accept") => {
    try {
      await record.mutateAsync({ engagementId: d.engagementId, jurisdiction: e.jurisdiction, action });
      await utils.invalidate();
      toast.success(`${e.jurisdiction === "federal" ? "Federal" : "State"} ${action === "accept" ? "acceptance recorded" : "e-file submitted"}`);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>E-file</CardTitle>
        <CardDescription>Record what the IRS and the FTB said. Complete needs both accepted.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {d.efile.map((e) => {
          const s = STATUS[e.status ?? "none"];
          return (
            <div key={e.jurisdiction} className="grid gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{WHERE[e.jurisdiction]}</span>
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
                      <Button variant="outline" size="sm" className="max-md:h-11" disabled={record.isPending} onClick={() => act(e, "accept")}>
                        Record accepted
                      </Button>
                      <Button variant="outline" size="sm" className="max-md:h-11" disabled={record.isPending} onClick={() => setRejecting(e.jurisdiction)}>
                        Record rejected…
                      </Button>
                    </>
                  ) : e.status !== "accepted" ? (
                    <Button variant="outline" size="sm" className="max-md:h-11" disabled={record.isPending} onClick={() => act(e, "submit")}>
                      {e.status === "rejected" ? "Submit again" : "Record submitted"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
      <RejectDialog d={d} jurisdiction={rejecting} onClose={() => setRejecting(null)} />
    </Card>
  );
}
