import type { EfileJurisdiction } from "@app/schema";
import { toast } from "sonner";

import { EfileCard as Card } from "@app/ui/components/efile-card";

import { trpc } from "@/lib/trpc";

import { errorText, type Detail } from "./shared";

// E-file, once a return is filed (admin 12-return-overview): federal to the IRS, state to the FTB. The card is
// EfileCard from the design system; this records each answer (engagement.recordEfile) and says how it went.

const where = (j: EfileJurisdiction) => (j === "federal" ? "Federal" : "State");

export function EfileCard({ d }: { d: Detail }) {
  const utils = trpc.useUtils();
  const record = trpc.engagement.recordEfile.useMutation();
  const reject = trpc.engagement.recordEfile.useMutation();

  const act = async (jurisdiction: EfileJurisdiction, action: "submit" | "accept") => {
    try {
      await record.mutateAsync({ engagementId: d.engagementId, jurisdiction, action });
      await utils.invalidate();
      toast.success(`${where(jurisdiction)} ${action === "accept" ? "acceptance recorded" : "e-file submitted"}`);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Card
      filings={d.efile}
      canRecord={d.stage === "filed"}
      pending={record.isPending}
      onSubmit={(j) => void act(j, "submit")}
      onAccept={(j) => void act(j, "accept")}
      onReject={async (jurisdiction, { rejectionCode, reason }) => {
        try {
          await reject.mutateAsync({ engagementId: d.engagementId, jurisdiction, action: "reject", rejectionCode, reason });
          await utils.invalidate();
          toast.success(`${where(jurisdiction)} rejection recorded`);
        } catch (e) {
          return errorText(e);
        }
      }}
    />
  );
}
