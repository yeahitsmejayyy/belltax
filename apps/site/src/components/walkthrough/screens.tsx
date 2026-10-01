import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { Checkbox } from "@app/ui/components/checkbox";
import { Input } from "@app/ui/components/input";
import { Logo, ShieldMark } from "@app/ui/components/logo";
import { Money } from "@app/ui/components/money";
import { Progress } from "@app/ui/components/progress";
import { StagePill } from "@app/ui/components/stage-pill";
import { DocumentChip, InvoiceChip, StatusChip } from "@app/ui/components/status-chip";
import { cn } from "@app/ui/utils";
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  Folder,
  House,
  Lock,
  PenLine,
  ShieldCheck,
  Upload,
  type LucideIcon,
} from "lucide-react";
import type * as React from "react";

import { CLIENT, INVOICE, NEEDS, REQUESTS } from "./fixtures";
import type { View } from "./script";

// The portal screens the phone plays (portal mobile 01-02, 05, 13, 14, 17, 19), drawn at 390 × 844 from the
// shared components with invented data. Static: the script sets the state, nothing here is interactive.

type Names = { practice: string; preparer: string; preparerFirst: string };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function PhoneScreen({ view, names }: { view: View; names: Names }) {
  switch (view.screen) {
    case "invite":
      return <Invite names={names} />;
    case "password":
      return <Password filled={view.filled} pending={!!view.pending} />;
    case "home":
      return <Home names={names} />;
    case "documents":
      return <Documents upload={view.upload} names={names} />;
    case "letter":
      return <Letter signed={view.signed} names={names} />;
    case "invoice":
      return <Invoice paid={view.paid} saved={!!view.saved} names={names} />;
  }
}

// The screen's root, keyed by screen in the walkthrough so a new screen rises in (btp-page: transform + opacity).
export function ScreenStage({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 animate-page">{children}</div>;
}

function Invite({ names }: { names: Names }) {
  return (
    <div className="grid gap-6 px-6 pt-24">
      <ShieldMark className="h-12 justify-self-start" />
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">Invitation from {names.practice}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{cap(names.preparer)} invited you to set up your account</h1>
        <p className="text-muted-foreground">This is where you'll answer a few questions, upload your tax documents, and see where your return stands.</p>
      </div>
      <div className="grid gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Your account email</p>
          <p className="font-medium">{CLIENT.email}</p>
        </div>
        <Button size="touch" tabIndex={-1} data-tap="setup">
          Set up my account
        </Button>
      </div>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Your documents are encrypted and only {names.preparerFirst} can see them. This invite link works once and expires in 7 days.
      </p>
    </div>
  );
}

function Password({ filled, pending }: { filled: boolean; pending: boolean }) {
  const dots = filled ? "••••••••••••••" : "";
  const rules = ["At least 12 characters", "Not your email address", "Both passwords match"];
  return (
    <div className="grid gap-6 px-6 pt-24">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Create a password</h1>
        <p className="text-muted-foreground">
          You'll use it with <span className="text-foreground">{CLIENT.email}</span> to sign in.
        </p>
      </div>
      <div className="grid gap-4">
        {["Password", "Type it again"].map((label) => (
          <div key={label} className="grid gap-2">
            <span className="text-sm font-medium">{label}</span>
            <Input readOnly tabIndex={-1} value={dots} className="h-11 text-base tracking-widest" />
          </div>
        ))}
        <ul className="grid gap-2 text-sm">
          {rules.map((r) => (
            <li key={r} className={cn("flex items-center gap-2", filled ? "text-success-foreground" : "text-muted-foreground")}>
              {filled ? <Check aria-hidden="true" className="size-4" /> : <CircleDashed aria-hidden="true" className="size-4" />}
              <span className="text-foreground">{r}</span>
            </li>
          ))}
        </ul>
        <Button size="touch" tabIndex={-1} data-tap="create" disabled={pending} className="disabled:opacity-70">
          {pending ? "Creating your account…" : "Create account"}
        </Button>
      </div>
    </div>
  );
}

type Tab = "home" | "questions" | "documents" | "letter" | "invoice";
const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "Home", icon: House },
  { key: "questions", label: "Questions", icon: ClipboardList },
  { key: "documents", label: "Documents", icon: Folder },
  { key: "letter", label: "Letter", icon: PenLine },
  { key: "invoice", label: "Invoice", icon: CreditCard },
];

// The portal shell: header, a clipped page, the bottom tabs.
function Shell({ tab, badges, toast, children }: { tab: Tab; badges: Partial<Record<Tab, number>>; toast?: string; children: React.ReactNode }) {
  return (
    <>
      <header className="absolute inset-x-0 top-14 flex h-16 items-center gap-3 border-b px-5">
        <Logo />
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-mode-demo px-2.5 text-xs font-semibold text-mode-demo-foreground">
          <span className="size-1.5 rounded-full bg-current" />
          Demo
        </span>
        <span className="ml-auto flex size-10 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand-subtle-foreground">
          {CLIENT.initials}
        </span>
      </header>
      {toast ? (
        <div className="absolute inset-x-0 top-32 z-10 flex justify-center px-5">
          <div className="flex animate-page items-center gap-2 rounded-lg border bg-popover px-4 py-3 text-sm font-medium text-popover-foreground shadow-lg">
            <CheckCircle2 aria-hidden="true" className="size-4 text-success-foreground" />
            {toast}
          </div>
        </div>
      ) : null}
      <div className="absolute inset-x-0 top-[120px] bottom-[88px] overflow-hidden px-5 pt-6">{children}</div>
      <nav className="absolute inset-x-0 bottom-0 grid h-[88px] grid-cols-5 border-t bg-background pb-5">
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <span
              key={t.key}
              data-tap={`tab-${t.key}`}
              className={cn("flex flex-col items-center justify-center gap-1 text-xs font-medium", on ? "font-semibold text-foreground" : "text-muted-foreground")}
            >
              <span className={cn("relative rounded-full px-4 py-1", on && "bg-brand-subtle text-brand-subtle-foreground")}>
                <t.icon aria-hidden="true" className="size-5" />
                {badges[t.key] ? (
                  <span className="absolute -top-1.5 right-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums">
                    {badges[t.key]}
                  </span>
                ) : null}
              </span>
              {t.label}
            </span>
          );
        })}
      </nav>
    </>
  );
}

const PageTitle = ({ children }: { children: React.ReactNode }) => <h1 className="text-3xl font-semibold tracking-tight">{children}</h1>;

function Home({ names }: { names: Names }) {
  return (
    <Shell tab="home" badges={{ documents: 3, letter: 1 }}>
      <div className="grid gap-5">
        <div className="grid gap-2">
          <PageTitle>Hi, {CLIENT.first}</PageTitle>
          <p className="text-muted-foreground">
            Your {CLIENT.taxYear} tax return · prepared by {names.preparer}
          </p>
          <div className="flex items-center gap-3">
            <StagePill stage="documents" />
            <span className="text-sm text-muted-foreground">Step 3 of 8</span>
          </div>
          <Progress value={33} className="mt-1 h-1.5" />
        </div>
        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-lg">{NEEDS.length} things need you</CardTitle>
            <CardDescription>Start with the first one. {cap(names.preparerFirst)} is notified as each is done.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 px-5">
            <ul className="divide-y rounded-lg border">
              {NEEDS.map((n) => (
                <li key={n.title} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid flex-1 justify-items-start gap-1.5">
                    <span className="font-medium">{n.title}</span>
                    {n.status === "unsigned" ? <StatusChip tone="neutral" icon={CircleDashed} label="Not signed" /> : <DocumentChip status={n.status} />}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </li>
              ))}
            </ul>
            <Button size="touch" tabIndex={-1}>
              Upload documents
            </Button>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function Documents({ upload, names }: { upload: "idle" | "uploading" | "done"; names: Names }) {
  const accepted = 1;
  const needed = upload === "done" ? 2 : 3;
  return (
    <Shell tab="documents" badges={{ documents: needed, letter: 1 }} toast={upload === "done" ? `Uploaded. ${cap(names.preparerFirst)} will check it.` : undefined}>
      <div className="grid gap-5">
        <div className="grid gap-2">
          <PageTitle>Documents</PageTitle>
          <p className="text-muted-foreground">
            {accepted} of 5 accepted · {needed} still needed from you
          </p>
          <Progress value={20} className="h-1.5 [&>*]:bg-success" />
        </div>
        <div className="grid gap-3 rounded-xl border border-dashed p-4">
          <Button size="touch" tabIndex={-1} data-tap="photo">
            <Camera aria-hidden="true" />
            Take a photo
          </Button>
          <Button size="touch" variant="outline" tabIndex={-1}>
            <Upload aria-hidden="true" />
            Choose a file
          </Button>
          {upload === "uploading" ? (
            <div className="grid gap-2 pt-1">
              <span className="text-sm text-muted-foreground">Uploading 1099-NEC photo…</span>
              <Progress value={64} className="h-1.5" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Photos are fine. Lay the page flat in good light with all four corners showing.</p>
          )}
        </div>
        <div className="grid gap-3">
          <h2 className="text-sm text-muted-foreground">{cap(names.preparerFirst)} asked for</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {REQUESTS.map((r, i) => (
              <li key={r.title} className="flex items-start gap-3 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <FileText aria-hidden="true" className="size-5" />
                </span>
                <span className="grid flex-1 justify-items-start gap-1">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-sm text-muted-foreground">{r.detail}</span>
                  <DocumentChip status={i === 1 && upload === "done" ? "uploaded" : r.status} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Shell>
  );
}

function Letter({ signed, names }: { signed: boolean; names: Names }) {
  return (
    <Shell tab="letter" badges={{ documents: 3, letter: signed ? 0 : 1 }} toast={signed ? "Letter signed" : undefined}>
      <div className="grid gap-5">
        <div className="grid gap-2">
          <PageTitle>Engagement letter</PageTitle>
          <p className="text-muted-foreground">This explains what {names.preparerFirst} will do for you and what it costs. Read it, then sign below.</p>
        </div>
        <div className="grid h-52 content-start gap-3 overflow-hidden rounded-xl border bg-card p-5 text-sm">
          <h2 className="text-base font-semibold">Tax year {CLIENT.taxYear} engagement letter</h2>
          <p className="text-muted-foreground">
            Between {names.preparer} ({names.practice}) and {CLIENT.full}.
          </p>
          <h3 className="font-semibold">What I'll do</h3>
          <p>Prepare your {CLIENT.taxYear} federal and California income tax returns from the information and documents you give me, and e-file them once you approve.</p>
        </div>
        {signed ? (
          <Banner tone="success" title={`Signed by ${CLIENT.full}`}>
            Signed today. A copy is saved in your documents.
          </Banner>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <span className="text-sm font-medium">Type your full legal name</span>
              <Input readOnly tabIndex={-1} value={CLIENT.full} className="h-11 text-base" />
            </div>
            <div className="flex items-start gap-3 text-sm">
              <Checkbox checked tabIndex={-1} className="mt-0.5" />
              <span>I've read this letter, I agree to it, and I agree to sign electronically.</span>
            </div>
            <Button size="touch" tabIndex={-1} data-tap="sign">
              <PenLine aria-hidden="true" />
              Sign letter
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Invoice({ paid, saved, names }: { paid: "no" | "processing" | "yes"; saved: boolean; names: Names }) {
  return (
    <Shell tab="invoice" badges={{ documents: 3 }} toast={saved ? "Receipt downloaded" : undefined}>
      <div className="grid gap-5">
        <PageTitle>Invoice</PageTitle>
        <Card className="gap-5 px-5 py-6">
          <p className="text-sm text-muted-foreground">
            Invoice {INVOICE.number} · Sent {INVOICE.sent}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Money cents={INVOICE.total} className="text-4xl font-bold tracking-tight" />
            {paid === "yes" ? <InvoiceChip status="paid" /> : <StatusChip tone="neutral" icon={CircleDashed} label="Due before filing" />}
          </div>
          <div className="grid gap-3 text-sm">
            <span className="text-muted-foreground">What it covers</span>
            {INVOICE.lines.map((l) => (
              <div key={l.label} className="flex justify-between gap-4">
                <span>{l.label}</span>
                <Money cents={l.cents} />
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t pt-3 font-semibold">
              <span>Total</span>
              <Money cents={INVOICE.total} />
            </div>
          </div>
          {paid === "yes" ? (
            <>
              <div className="flex items-start gap-3 rounded-lg bg-success-subtle p-4 text-sm text-success-foreground">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {INVOICE.paid}
              </div>
              <Button size="touch" variant="outline" tabIndex={-1} data-tap="receipt">
                <Download aria-hidden="true" />
                Download receipt
              </Button>
            </>
          ) : (
            <>
              <Button size="touch" tabIndex={-1} data-tap="pay" disabled={paid === "processing"} className="disabled:opacity-70">
                {paid === "processing" ? (
                  "Opening secure checkout…"
                ) : (
                  <>
                    Pay <Money cents={INVOICE.total} />
                  </>
                )}
              </Button>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                You'll pay on Stripe's secure checkout page. {names.practice} never sees your card number.
              </p>
            </>
          )}
        </Card>
      </div>
    </Shell>
  );
}
