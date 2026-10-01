import { Archive, ArchiveRestore, CheckCircle2, ChevronRight, CircleDashed, Clock, KeyRound, UserX } from "lucide-react";
import { toast } from "sonner";
import { Link, useParams } from "react-router-dom";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { PageHeader } from "@app/ui/components/page-header";
import { Skeleton } from "@app/ui/components/skeleton";
import { StagePill } from "@app/ui/components/stage-pill";
import { StatusChip } from "@app/ui/components/status-chip";
import { formatDate } from "@app/ui/format";

import { ExportHouseholdDialog } from "@/components/clients/export-dialog";
import { FILING_SHORT } from "@/lib/labels";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// A household (admin 28-clients-invoices-and-activity-household): its people, who can open it, its returns by
// year, and the Archive and Export actions. SSNs show the last four only, never more.

type Detail = RouterOutputs["household"]["get"];
type Member = Detail["members"][number];

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function age(dob: string) {
  const b = new Date(`${dob}T12:00:00Z`);
  const now = new Date();
  let a = now.getFullYear() - b.getUTCFullYear();
  if (now.getMonth() < b.getUTCMonth() || (now.getMonth() === b.getUTCMonth() && now.getDate() < b.getUTCDate())) a--;
  return a;
}

function LoginChip({ m }: { m: Member }) {
  if (!m.login) return <StatusChip tone="neutral" icon={UserX} label="No login" />;
  return m.login.activated ? <StatusChip tone="success" icon={CheckCircle2} label="Has portal login" /> : <StatusChip tone="brand" icon={Clock} label="Invited" />;
}

function MemberRow({ m }: { m: Member }) {
  const name = [m.firstName, m.middleName, m.lastName, m.suffix].filter(Boolean).join(" ");
  const facts = [m.dateOfBirth ? `Born ${formatDate(`${m.dateOfBirth}T12:00:00Z`)}` : null, m.dateOfBirth ? (age(m.dateOfBirth) >= 18 ? "Adult" : `Age ${age(m.dateOfBirth)}`) : null]
    .filter(Boolean)
    .join(" · ");
  const contact = [m.email, m.phone].filter(Boolean).join(" · ");
  return (
    <li className="grid gap-2 border-b py-3 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6">
      <div className="grid gap-0.5">
        <span className="font-medium">{name}</span>
        {facts ? <span className="text-sm text-muted-foreground">{facts}</span> : null}
        {contact ? <span className="text-sm break-all text-muted-foreground">{contact}</span> : null}
      </div>
      <span className="text-sm tabular-nums text-muted-foreground" aria-label={m.ssnLast4 ? `SSN ending ${m.ssnLast4}` : "No SSN on file"}>
        {m.ssnLast4 ? `•••-••-${m.ssnLast4}` : "No SSN"}
      </span>
      <LoginChip m={m} />
    </li>
  );
}

function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading the household">
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

export default function Household() {
  const { id = "" } = useParams();
  const q = trpc.household.get.useQuery({ householdId: id }, { enabled: !!id });
  const h = q.data;
  usePageTitle(h?.displayName ?? "Household", { label: "Clients", to: "/clients" });

  const utils = trpc.useUtils();
  const update = trpc.household.update.useMutation();

  if (q.error) return <Banner tone="danger" title="This household can't be opened">{q.error.message}</Banner>;
  if (!h) return <Loading />;

  const setArchived = async (archived: boolean) => {
    try {
      await update.mutateAsync({ householdId: h.id, archived });
      await utils.invalidate();
      toast.success(archived ? `${h.displayName} archived` : `${h.displayName} is back in Clients`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't go through.");
    }
  };

  const firstYear = h.returns.length ? Math.min(...h.returns.map((r) => r.taxYear)) : null;
  const access = h.access.filter((a) => !a.revokedAt);

  return (
    <div className="grid grid-cols-1 animate-page gap-6">
      <PageHeader
        title={h.displayName}
        description={[plural(h.members.length, "member"), firstYear ? `client since TY ${firstYear}` : null, h.archivedAt ? `archived ${formatDate(h.archivedAt)}` : null]
          .filter(Boolean)
          .join(" · ")}
        action={
          <>
            <Button variant="ghost" onClick={() => setArchived(!h.archivedAt)} disabled={update.isPending}>
              {h.archivedAt ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
              {h.archivedAt ? "Unarchive" : "Archive"}
            </Button>
            <ExportHouseholdDialog householdId={h.id} name={h.displayName} />
          </>
        }
      />

      {h.archivedAt ? (
        <Banner tone="info" title="Archived">
          It's hidden from Clients unless you show archived households. Nothing was deleted.
        </Banner>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>SSNs show the last 4 digits only.</CardDescription>
          </CardHeader>
          <CardContent>
            {h.members.length ? (
              <ul>{h.members.map((m) => <MemberRow key={m.personId} m={m} />)}</ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nobody in this household yet.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Returns by tax year</CardTitle>
            </CardHeader>
            <CardContent>
              {h.returns.length ? (
                <ul className="grid gap-1">
                  {h.returns.map((r) => (
                    <li key={r.engagementId}>
                      <Link
                        to={`/returns/${r.engagementId}`}
                        className="grid min-h-11 grid-cols-[4.5rem_1fr_auto_auto] items-center gap-3 rounded-md px-2 py-2 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <span className="font-medium tabular-nums">TY {r.taxYear}</span>
                        <span className="truncate text-sm">
                          {r.filers.join(" & ") || "No filers yet"}
                          {r.filingStatus ? ` · ${FILING_SHORT[r.filingStatus]}` : ""}
                          {r.kind === "amended" ? " · Amended" : ""}
                        </span>
                        <StagePill stage={r.stage} />
                        <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No returns yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Portal access</CardTitle>
              <CardDescription>Who can sign in and open this household.</CardDescription>
            </CardHeader>
            <CardContent>
              {h.access.length ? (
                <ul className="grid gap-3">
                  {h.access.map((a) => (
                    <li key={a.grantId} className="flex flex-wrap items-center justify-between gap-2">
                      <div className="grid gap-0.5">
                        <span className="text-sm font-medium">{a.name ?? a.email}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.name ? `${a.email} · ` : ""}since {formatDate(a.grantedAt)}
                        </span>
                      </div>
                      {a.revokedAt ? (
                        <StatusChip tone="neutral" icon={CircleDashed} label={`Revoked ${formatDate(a.revokedAt)}`} />
                      ) : (
                        <StatusChip tone="success" icon={KeyRound} label="Can open" />
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              {!access.length ? <p className="text-sm text-muted-foreground">{h.access.length ? "Nobody can open it now." : "Nobody can sign in to this household yet."}</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
