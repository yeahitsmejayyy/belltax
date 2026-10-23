import * as React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { plural, type AdminLink } from "@app/ui/components/admin-clients";
import { NewSeasonPage, type RolloverReport } from "@app/ui/components/new-season";

import { useTaxYear } from "@/lib/tax-year";
import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// New season (no mockup; the table and dialog patterns of admin 06 and 19): every completed original return from
// one tax year becomes next year's return, same people and still-open sources. Preview first, then one action.
// The screen is NewSeasonPage from the design system; this keeps the fetching, the rollover and the toast.

const renderLink: AdminLink = (to, children, className, onClick) => (
  <Link to={to} className={className} onClick={onClick}>
    {children}
  </Link>
);

export default function Season() {
  usePageTitle("New season", { label: "Settings", to: "/settings" });
  const { years } = useTaxYear();
  const [chosen, setChosen] = React.useState<number | undefined>();
  const fromYear = chosen ?? years[0];
  const q = trpc.season.preview.useQuery({ fromYear: fromYear! }, { enabled: !!fromYear });
  const utils = trpc.useUtils();
  const rollover = trpc.season.rollover.useMutation();
  const [confirm, setConfirm] = React.useState(false);
  const [report, setReport] = React.useState<RolloverReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = async () => {
    if (!fromYear) return;
    setError(null);
    try {
      const r = await rollover.mutateAsync({ fromYear });
      setReport(r);
      await utils.invalidate();
      toast.success(`TY ${r.toYear}: ${plural(r.created.length, "return")} opened`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The rollover didn't run.");
    } finally {
      setConfirm(false);
    }
  };

  return (
    <NewSeasonPage
      years={years}
      fromYear={fromYear}
      onFromYearChange={(y) => {
        setChosen(y);
        setReport(null);
        setError(null);
      }}
      preview={q.data}
      previewError={q.error?.message}
      report={report}
      error={error}
      confirmOpen={confirm}
      onConfirmOpenChange={setConfirm}
      onRollover={() => void run()}
      pending={rollover.isPending}
      renderLink={renderLink}
    />
  );
}
