import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { AdminLink } from "@app/ui/components/admin-clients";
import { ReturnLoading, ReturnNotFound, ReturnPage as Page, type ReturnTab } from "@app/ui/components/return-page";

import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

import { ActivityTab } from "./activity-tab";
import { BillingTab } from "./billing-tab";
import { DocumentsTab } from "./documents-tab";
import { IntakeTab } from "./intake-tab";
import { InvoiceDialog } from "./invoice-dialog";
import { LetterTab } from "./letter-tab";
import { OverviewTab } from "./overview-tab";
import { RequestSheet } from "./request-sheet";
import { ReturnHeader } from "./return-header";
import { filersName } from "./shared";

// One return (admin 12–18-return-detail, 37-phone-m-return): the header with its one primary action, then a
// tab per job. Tabs are URL segments, so /returns/:id/billing opens straight onto Billing. The frame and tab bar are
// ReturnPage from the design system; this fetches the return, keeps the open tab in the URL and wires each tab.

const TABS = ["overview", "intake", "documents", "letter", "billing", "activity"] as const;
type Tab = (typeof TABS)[number];

const renderLink: AdminLink = (to, children, className, onClick) => (
  <Link to={to} className={className} onClick={onClick}>
    {children}
  </Link>
);

export default function ReturnPage() {
  const { id = "", tab: rawTab } = useParams();
  const navigate = useNavigate();
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "overview";
  const q = trpc.engagement.detail.useQuery({ engagementId: id }, { enabled: !!id, retry: false });
  const d = q.data;
  const name = d ? filersName(d) : "Return";
  usePageTitle(name, { label: "Pipeline", to: "/pipeline" });

  const [requesting, setRequesting] = React.useState(false);
  const [invoicing, setInvoicing] = React.useState(false);

  if (q.error) return <ReturnNotFound renderLink={renderLink} />;
  if (!d) return <ReturnLoading />;

  const toReview = d.documents.filter((x) => x.status === "uploaded").length;
  const paymentFailed = d.invoices.some((i) => i.settlement === "failed_last_attempt");
  const go = (t: string) => navigate(t === "overview" ? `/returns/${id}` : `/returns/${id}/${t}`);

  const tabs: ReturnTab<Tab>[] = [
    { value: "overview", label: "Overview", content: <OverviewTab d={d} onRequest={() => setRequesting(true)} onBilling={() => go("billing")} /> },
    { value: "intake", label: "Intake", content: <IntakeTab d={d} /> },
    { value: "documents", label: "Documents", count: toReview, countLabel: "to review", content: <DocumentsTab d={d} onRequest={() => setRequesting(true)} /> },
    { value: "letter", label: "Letter", content: <LetterTab d={d} /> },
    { value: "billing", label: "Billing", alert: paymentFailed ? "A payment failed" : null, content: <BillingTab d={d} onCreate={() => setInvoicing(true)} /> },
    { value: "activity", label: "Activity", content: <ActivityTab engagementId={d.engagementId} /> },
  ];

  return (
    <Page
      header={<ReturnHeader d={d} name={name} onRequest={() => setRequesting(true)} onInvoice={() => setInvoicing(true)} />}
      tabs={tabs}
      value={tab}
      onValueChange={go}
    >
      <RequestSheet d={d} name={name} open={requesting} onOpenChange={setRequesting} />
      <InvoiceDialog d={d} name={name} open={invoicing} onOpenChange={setInvoicing} />
    </Page>
  );
}
