import * as React from "react";
import { toast } from "sonner";
import { Link, useParams } from "react-router-dom";

import type { AdminLink } from "@app/ui/components/admin-clients";
import { HouseholdDetail, type HouseholdDetailData, type LoginActionHandlers } from "@app/ui/components/household-detail";

import { FILING_SHORT } from "@/lib/labels";
import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// A household (admin 28-clients-invoices-and-activity-household): its people, who can open it, its returns by
// year, and the Archive and Export actions. The screen is HouseholdDetail from the design system; this keeps the
// fetching, the mutations and the toasts.

const renderLink: AdminLink = (to, children, className, onClick) => (
  <Link to={to} className={className} onClick={onClick}>
    {children}
  </Link>
);

export default function Household() {
  const { id = "" } = useParams();
  const q = trpc.household.get.useQuery({ householdId: id }, { enabled: !!id });
  const h = q.data;
  usePageTitle(h?.displayName ?? "Household", { label: "Clients", to: "/clients" });

  const utils = trpc.useUtils();
  const update = trpc.household.update.useMutation();
  const exportRun = trpc.household.export.useMutation();
  const link = trpc.login.link.useMutation();
  const out = trpc.login.signOutEverywhere.useMutation();

  const household = React.useMemo<HouseholdDetailData | undefined>(
    () => h && { ...h, returns: h.returns.map((r) => ({ ...r, filingLabel: r.filingStatus ? FILING_SHORT[r.filingStatus] : null })) },
    [h],
  );

  const loginHandlers: LoginActionHandlers = {
    onLink: async (login, purpose) => {
      try {
        return await link.mutateAsync({ userId: login.userId, purpose });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That didn't go through.");
      }
    },
    onSignOutEverywhere: async (login) => {
      try {
        const r = await out.mutateAsync({ userId: login.userId });
        toast.success(r.ended ? `Signed out of ${r.ended} ${r.ended === 1 ? "browser" : "browsers"}` : "Wasn't signed in anywhere");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That didn't go through.");
      }
    },
  };

  const setArchived = async (archived: boolean) => {
    if (!h) return;
    try {
      await update.mutateAsync({ householdId: h.id, archived });
      await utils.invalidate();
      toast.success(archived ? `${h.displayName} archived` : `${h.displayName} is back in Clients`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't go through.");
    }
  };

  return (
    <HouseholdDetail
      household={household}
      error={q.error?.message}
      onArchive={(archived) => void setArchived(archived)}
      archivePending={update.isPending}
      onExport={async ({ encrypt }) => {
        const r = await exportRun.mutateAsync({ householdId: id, encrypt });
        toast.success(`${h?.displayName} exported`);
        return r;
      }}
      {...loginHandlers}
      renderLink={renderLink}
    />
  );
}
