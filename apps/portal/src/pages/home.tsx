import { FileText } from "lucide-react";

import { EmptyState } from "@app/ui/components/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@app/ui/components/select";
import { Skeleton } from "@app/ui/components/skeleton";

import { InvoiceCard } from "@/components/home/invoice-card";
import { NeedsCard, needsFor } from "@/components/home/needs-card";
import { StageProgress } from "@/components/home/stage-progress";
import { usePageTitle, useReturn, type MyReturn } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// Home (portal 05-home, 06 dark, 07 offline; desktop 22-desktop-d-home): what needs the client, the
// invoice, and where the return stands. One column on a phone, two on a desktop.

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

function returnLabel(r: MyReturn, households: boolean) {
  const year = `TY ${r.taxYear}${r.kind === "amended" ? " amended" : ""}`;
  return households ? `${r.householdName} · ${year}` : year;
}

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

  const preparerFirst = firstName(practice.data.preparerName);
  const needs = needsFor({ stage: current.stage, requests: requests.data, letter: letter.data ?? null, intake: intake.data ?? null });
  const invoice = invoices.data.find((i) => i.status === "issued");
  const households = new Set(all.map((r) => r.householdName)).size > 1;

  return (
    <div className="grid grid-cols-1 animate-page gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Hi, {firstName(me.data.name)}</h1>
          <p className="text-muted-foreground">
            Your {current.taxYear} {current.kind === "amended" ? "amended " : ""}tax return · prepared by {practice.data.preparerName}
          </p>
        </div>
        {all.length > 1 ? (
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
        ) : null}
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="grid grid-cols-1 gap-6">
          <NeedsCard needs={needs} stage={current.stage} preparer={preparerFirst} />
          {invoice ? <InvoiceCard invoice={invoice} preparer={preparerFirst} /> : null}
        </div>
        <StageProgress ret={current} preparer={preparerFirst} />
      </div>
    </div>
  );
}
