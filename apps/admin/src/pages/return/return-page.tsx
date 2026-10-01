import { FileQuestion } from "lucide-react";
import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@app/ui/components/button";
import { EmptyState } from "@app/ui/components/empty-state";
import { Skeleton } from "@app/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@app/ui/components/tabs";

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
// tab per job. Tabs are URL segments, so /returns/:id/billing opens straight onto Billing.

const TABS = ["overview", "intake", "documents", "letter", "billing", "activity"] as const;
type Tab = (typeof TABS)[number];

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

  if (q.error) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="This return isn't here"
        description="It may have been removed, or the link is wrong."
        action={
          <Button variant="outline" asChild>
            <Link to="/pipeline">Back to the pipeline</Link>
          </Button>
        }
      />
    );
  }
  if (!d) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Loading the return">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <Skeleton className="h-10 w-[28rem] max-w-full" />
        <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-80 rounded-xl" />)}</div>
      </div>
    );
  }

  const toReview = d.documents.filter((x) => x.status === "uploaded").length;
  const paymentFailed = d.invoices.some((i) => i.settlement === "failed_last_attempt");
  const go = (t: string) => navigate(t === "overview" ? `/returns/${id}` : `/returns/${id}/${t}`);

  return (
    <div className="grid grid-cols-1 animate-page gap-6">
      <ReturnHeader d={d} name={name} onRequest={() => setRequesting(true)} onInvoice={() => setInvoicing(true)} />

      <Tabs value={tab} onValueChange={go} className="min-w-0">
        <TabsList className="max-md:h-12 max-md:[&>button]:min-h-11">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="intake">Intake</TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            {toReview ? (
              <span className="rounded-full bg-brand-subtle px-1.5 text-xs font-semibold text-brand-subtle-foreground tabular-nums">
                {toReview}
                <span className="sr-only"> to review</span>
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="letter">Letter</TabsTrigger>
          <TabsTrigger value="billing">
            Billing
            {paymentFailed ? (
              <span className="flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white" title="A payment failed">
                !<span className="sr-only">A payment failed</span>
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab d={d} onRequest={() => setRequesting(true)} onBilling={() => go("billing")} />
        </TabsContent>
        <TabsContent value="intake">
          <IntakeTab d={d} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab d={d} onRequest={() => setRequesting(true)} />
        </TabsContent>
        <TabsContent value="letter">
          <LetterTab d={d} />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab d={d} onCreate={() => setInvoicing(true)} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab engagementId={d.engagementId} />
        </TabsContent>
      </Tabs>

      <RequestSheet d={d} name={name} open={requesting} onOpenChange={setRequesting} />
      <InvoiceDialog d={d} name={name} open={invoicing} onOpenChange={setInvoicing} />
    </div>
  );
}
