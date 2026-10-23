import type { Stage } from "@app/schema";
import { Archive, ArchiveRestore, CheckCircle2, ChevronRight, CircleDashed, Clock, KeyRound, LogOut, UserX } from "lucide-react";
import * as React from "react";

import { formatDate } from "../format";
import { adminAnchor, plural, type AdminLink } from "./admin-clients";
import { Banner } from "./banner";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { CopyLink } from "./copy-link";
import { ExportHouseholdDialog, type ExportResult } from "./export-household-dialog";
import { PageHeader } from "./page-header";
import { Skeleton } from "./skeleton";
import { StagePill } from "./stage-pill";
import { StatusChip } from "./status-chip";

// A household in the preparer admin (admin 28-clients-invoices-and-activity-household), the pieces apps/admin renders
// and Storybook shows (ticket 58): its people, who can open it, its returns by year, and the Archive and Export actions.
// SSNs show the last four only, never more. Data in; the app does the mutations and toasts through the callbacks.

/** A portal login on a member: an invite until they've set up sign-in (`activated`), then a reset. */
export type MemberLogin = { userId: string; email: string; activated: boolean };

/** One person in the household, as `household.get` returns them. */
export type HouseholdMember = {
  personId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  /** YYYY-MM-DD. */
  dateOfBirth: string | null;
  /** The last four digits only. */
  ssnLast4: string | null;
  email: string | null;
  phone: string | null;
  login: MemberLogin | null;
};

/** One return of the household's. `filingLabel` is the short filing status ("MFJ"), already worded by the app. */
export type HouseholdReturn = { engagementId: string; taxYear: number; kind: "original" | "amended"; stage: Stage; filingLabel: string | null; filers: string[] };

/** One portal access grant, live or revoked. */
export type HouseholdAccess = { grantId: string; email: string; name: string | null; grantedAt: string; revokedAt: string | null };

export type HouseholdDetailData = {
  id: string;
  displayName: string;
  archivedAt: string | null;
  members: HouseholdMember[];
  returns: HouseholdReturn[];
  access: HouseholdAccess[];
};

/** A one-time link the server made: its address, and whether it was emailed too. */
export type LoginLinkResult = { url: string; emailed: boolean };

/** What the preparer can do with a member's login. Each resolves when done; resolve with nothing if it failed (the app says why). */
export type LoginActionHandlers = {
  onLink: (login: MemberLogin, purpose: "invite" | "reset") => Promise<LoginLinkResult | null | undefined | void>;
  onSignOutEverywhere: (login: MemberLogin) => Promise<unknown>;
};

function age(dob: string) {
  const b = new Date(`${dob}T12:00:00Z`);
  const now = new Date();
  let a = now.getFullYear() - b.getUTCFullYear();
  if (now.getMonth() < b.getUTCMonth() || (now.getMonth() === b.getUTCMonth() && now.getDate() < b.getUTCDate())) a--;
  return a;
}

/** Whether a member can sign in: no login, invited, or has one. */
export function LoginChip({ login }: { login: MemberLogin | null }) {
  if (!login) return <StatusChip tone="neutral" icon={UserX} label="No login" />;
  return login.activated ? <StatusChip tone="success" icon={CheckCircle2} label="Has portal login" /> : <StatusChip tone="brand" icon={Clock} label="Invited" />;
}

/**
 * The preparer's controls over a login (tickets 05, 05b): a one-time link to hand over (an invite until they've set up
 * sign-in, a reset after, which replaces their passkeys), and signing them out of every browser.
 */
export function LoginActions({ login, onLink, onSignOutEverywhere }: { login: MemberLogin } & LoginActionHandlers) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [emailed, setEmailed] = React.useState(false);
  const [linking, setLinking] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const purpose = login.activated ? "reset" : "invite";
  const link = async () => {
    setLinking(true);
    try {
      const r = await onLink(login, purpose);
      if (r) {
        setUrl(r.url);
        setEmailed(r.emailed);
      }
    } finally {
      setLinking(false);
    }
  };
  const out = async () => {
    setSigningOut(true);
    try {
      await onSignOutEverywhere(login);
    } finally {
      setSigningOut(false);
    }
  };
  return (
    <div className="grid gap-2 sm:col-span-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void link()} disabled={linking}>
          <KeyRound aria-hidden="true" /> {purpose === "invite" ? "Invite link" : "Sign-in reset link"}
        </Button>
        {login.activated ? (
          <Button variant="ghost" size="sm" onClick={() => void out()} disabled={signingOut}>
            <LogOut aria-hidden="true" /> Sign out everywhere
          </Button>
        ) : null}
      </div>
      {url ? (
        <CopyLink
          url={url}
          label={purpose === "invite" ? `Invite link for ${login.email}` : `Reset link for ${login.email}`}
          note={`${emailed ? `Emailed to ${login.email}; here too in case they need it another way.` : "Send it to them yourself."} ${purpose === "invite" ? "It works once, for 7 days." : "It works once, for 24 hours: it removes their old passkeys and signs them out everywhere."}`}
        />
      ) : null}
    </div>
  );
}

/** One person: name, birth date and age, contact, SSN last four, login state, and the login's actions. */
export function MemberRow({ member: m, ...handlers }: { member: HouseholdMember } & LoginActionHandlers) {
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
      <LoginChip login={m.login} />
      {m.login ? <LoginActions login={m.login} {...handlers} /> : null}
    </li>
  );
}

/** The Members card. */
export function MembersCard({ members, ...handlers }: { members: HouseholdMember[] } & LoginActionHandlers) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>SSNs show the last 4 digits only.</CardDescription>
      </CardHeader>
      <CardContent>
        {members.length ? (
          <ul>{members.map((m) => <MemberRow key={m.personId} member={m} {...handlers} />)}</ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nobody in this household yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** The return's page, from its id. */
export const returnHref = (engagementId: string) => `/returns/${engagementId}`;

/** Returns by tax year, each a link to the return. */
export function ReturnsCard({ returns, renderLink = adminAnchor, hrefFor = returnHref }: { returns: HouseholdReturn[]; renderLink?: AdminLink; hrefFor?: (engagementId: string) => string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Returns by tax year</CardTitle>
      </CardHeader>
      <CardContent>
        {returns.length ? (
          <ul className="grid gap-1">
            {returns.map((r) => (
              <li key={r.engagementId}>
                {renderLink(
                  hrefFor(r.engagementId),
                  <>
                    <span className="font-medium tabular-nums">TY {r.taxYear}</span>
                    <span className="truncate text-sm">
                      {r.filers.join(" & ") || "No filers yet"}
                      {r.filingLabel ? ` · ${r.filingLabel}` : ""}
                      {r.kind === "amended" ? " · Amended" : ""}
                    </span>
                    <StagePill stage={r.stage} />
                    <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                  </>,
                  "grid min-h-11 grid-cols-[4.5rem_1fr_auto_auto] items-center gap-3 rounded-md px-2 py-2 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No returns yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Who can sign in and open the household, revoked grants included. */
export function AccessCard({ access }: { access: HouseholdAccess[] }) {
  const live = access.filter((a) => !a.revokedAt);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portal access</CardTitle>
        <CardDescription>Who can sign in and open this household.</CardDescription>
      </CardHeader>
      <CardContent>
        {access.length ? (
          <ul className="grid gap-3">
            {access.map((a) => (
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
        {!live.length ? <p className="text-sm text-muted-foreground">{access.length ? "Nobody can open it now." : "Nobody can sign in to this household yet."}</p> : null}
      </CardContent>
    </Card>
  );
}

/** While the household loads. */
export function HouseholdLoading() {
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

export type HouseholdDetailProps = LoginActionHandlers & {
  /** The household; undefined while it loads. */
  household?: HouseholdDetailData;
  /** Why it can't be opened, instead of the page. */
  error?: string | null;
  /** Archive (true) or bring back (false). */
  onArchive: (archived: boolean) => void;
  archivePending?: boolean;
  /** Runs the export (see ExportHouseholdDialog). */
  onExport: (options: { encrypt: boolean }) => Promise<ExportResult>;
  renderLink?: AdminLink;
  returnHrefFor?: (engagementId: string) => string;
};

/** The whole household screen. */
export function HouseholdDetail({ household: h, error, onArchive, archivePending = false, onExport, onLink, onSignOutEverywhere, renderLink, returnHrefFor }: HouseholdDetailProps) {
  if (error) return <Banner tone="danger" title="This household can't be opened">{error}</Banner>;
  if (!h) return <HouseholdLoading />;

  const firstYear = h.returns.length ? Math.min(...h.returns.map((r) => r.taxYear)) : null;

  return (
    <div className="grid grid-cols-1 animate-page gap-6">
      <PageHeader
        title={h.displayName}
        description={[plural(h.members.length, "member"), firstYear ? `client since TY ${firstYear}` : null, h.archivedAt ? `archived ${formatDate(h.archivedAt)}` : null]
          .filter(Boolean)
          .join(" · ")}
        action={
          <>
            <Button variant="ghost" onClick={() => onArchive(!h.archivedAt)} disabled={archivePending}>
              {h.archivedAt ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
              {h.archivedAt ? "Unarchive" : "Archive"}
            </Button>
            <ExportHouseholdDialog name={h.displayName} onExport={onExport} />
          </>
        }
      />

      {h.archivedAt ? (
        <Banner tone="info" title="Archived">
          It's hidden from Clients unless you show archived households. Nothing was deleted.
        </Banner>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <MembersCard members={h.members} onLink={onLink} onSignOutEverywhere={onSignOutEverywhere} />

        <div className="grid gap-4">
          <ReturnsCard returns={h.returns} renderLink={renderLink} hrefFor={returnHrefFor} />
          <AccessCard access={h.access} />
        </div>
      </div>
    </div>
  );
}
