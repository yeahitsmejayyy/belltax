import { FileText } from "lucide-react";
import { Link } from "react-router-dom";

import { TryThis } from "@app/ui/components/demo-tour";
import { EmptyState } from "@app/ui/components/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@app/ui/components/select";
import { Skeleton } from "@app/ui/components/skeleton";

import { ClientHome } from "@app/ui/components/client-home";

import { useDemoTour, useDismissed } from "@/lib/demo-tour";
import { needsFor } from "@/lib/needs";
import { usePageTitle, useReturn, type MyReturn } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// Home (portal 05-home, 06 dark, 07 offline; desktop 22-desktop-d-home): the data for ClientHome (packages/ui, ticket
// 56), which draws the greeting, what needs the client, the invoice and where the return stands.

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

function returnLabel(r: MyReturn, households: boolean) {
  const year = `TY ${r.taxYear}${r.kind === "amended" ? " amended" : ""}`;
  return households ? `${r.householdName} · ${year}` : year;
}

// The public demo's suggestions for a first visit (ticket 45).
const CLIENT_TIPS = [
  { id: "documents", label: "Send a document", detail: "See what's been asked for, and why one was sent back.", href: "/documents" },
  { id: "letter", label: "Sign the engagement letter", detail: "Read it, type your name, sign.", href: "/letter" },
  { id: "questions", label: "Answer a few questions", detail: "Answers save as you go.", href: "/questions" },
];

export default function Home() {
  usePageTitle("Home");
  const { all, current, choose, loading } = useReturn();
  const id = current?.engagementId;
  const me = trpc.me.get.useQuery(undefined, { staleTime: 60_000 });
  const practice = trpc.practice.public.useQuery(undefined, { staleTime: Infinity });
  const requests = trpc.request.list.useQuery({ engagementId: id! }, { enabled: !!id });
  const letter = trpc.letter.get.useQuery({ engagementId: id! }, { enabled: !!id });
  const intake = trpc.intake.get.useQuery({ engagementId: id! }, { enabled: !!id });
  const invoices = trpc.invoice.list.useQuery({ engagementId: id! }, { enabled: !!id });
  const tour = useDemoTour();
  const [tipsHidden, hideTips] = useDismissed("portal-home");

  if (!loading && !current) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <EmptyState icon={FileText} title="No return yet" description="When your preparer opens your return, it shows up here with everything they need from you." />
      </div>
    );
  }

  const ready = current && me.data && practice.data && requests.data && letter.isSuccess && intake.isSuccess && invoices.data;
  if (!ready) {
    return (
      <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Loading your return">
        <div className="grid gap-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  const needs = needsFor({ stage: current.stage, requests: requests.data, letter: letter.data ?? null, intake: intake.data ?? null });
  const invoice = invoices.data.find((i) => i.status === "issued");
  const households = new Set(all.map((r) => r.householdName)).size > 1;

  return (
    <ClientHome
      firstName={firstName(me.data.name)}
      taxYear={current.taxYear}
      amended={current.kind === "amended"}
      preparerName={practice.data.preparerName}
      stage={current.stage}
      reached={current.reached}
      needs={needs}
      invoice={invoice}
      renderLink={(to, children, className) => (
        <Link to={to} className={className}>
          {children}
        </Link>
      )}
      picker={
        all.length > 1 ? (
          <Select value={current.engagementId} onValueChange={choose}>
            <SelectTrigger size="touch" aria-label="Which return" className="max-w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {all.map((r) => (
                <SelectItem key={r.engagementId} value={r.engagementId}>
                  {returnLabel(r, households)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null
      }
      tips={
        tour && !tipsHidden ? (
          <TryThis
            items={CLIENT_TIPS}
            onDismiss={hideTips}
            renderLink={(item, className, children) => (
              <Link to={item.href} className={className}>
                {children}
              </Link>
            )}
          />
        ) : null
      }
    />
  );
}
