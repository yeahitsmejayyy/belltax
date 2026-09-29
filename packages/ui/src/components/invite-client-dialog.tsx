import type { FilingStatus, ReturnRole } from "@app/schema";
import { CircleAlert, CircleCheck, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { Banner } from "./banner";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Input } from "./input";
import { Label } from "./label";
import { RadioCard, RadioGroup } from "./radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { StepList } from "./stepper";

// Invite client, or add one without an invite (admin 24/25-dialogs-and-sheets-dlg-invite and the prototype's
// invite flow): Household → Members → Filers → Send (or Save) → done. The Invite client split button opens it in
// "invite" mode; "Add client without invite" opens it in "add" mode, where the email waits until later.
//
// It only collects and checks. `onSubmit` gets the finished draft and does the work (household.create,
// person.add, engagement.create, login.create); if it throws, the message shows and nothing moves on.
// Validation follows principles.md rule 10: on leaving a field, live once an error has shown, and on Continue.

// The schema's own values, so a draft maps straight onto the API. Qualifying surviving spouse isn't offered for a
// new household; it's set on the return when it applies.
export type Role = ReturnRole;
export type Filing = Exclude<FilingStatus, "qss">;
export type InviteDraft = {
  mode: "invite" | "add";
  surname: string;
  email: string;
  phone: string;
  members: { first: string; role: Role }[];
  filing: Filing;
  filers: number[]; // indexes into members
};

const FILINGS: { v: Filing; label: string; short: string; desc: string }[] = [
  { v: "single", label: "Single", short: "Single", desc: "One return, one filer" },
  { v: "mfj", label: "Married filing jointly", short: "MFJ", desc: "One return for both spouses" },
  { v: "mfs", label: "Married filing separately", short: "MFS", desc: "Two returns under this household, one per spouse" },
  { v: "hoh", label: "Head of household", short: "HOH", desc: "One return, unmarried with a dependent" },
];
const ROLE_LABEL: Record<Role, string> = { primary: "Primary", spouse: "Spouse", dependent: "Dependent" };

const empty = (mode: InviteDraft["mode"]): InviteDraft => ({ mode, surname: "", email: "", phone: "", members: [{ first: "", role: "primary" }], filing: "single", filers: [0] });

const digits = (s: string) => s.replace(/\D/g, "");

function errors(d: InviteDraft) {
  const hasSpouse = d.members.some((m) => m.role === "spouse");
  const hasDependent = d.members.some((m) => m.role === "dependent");
  const household = {
    surname: d.surname.trim() ? "" : "Enter the household surname.",
    email: !d.email.trim() ? (d.mode === "add" ? "" : "Enter the email the invite goes to.") : /.+@.+\..+/.test(d.email.trim()) ? "" : "Enter a valid email, like m@example.com.",
    phone: d.phone.trim() && digits(d.phone).length !== 10 ? "Enter a 10-digit US number, or leave it blank." : "",
  };
  const members = d.members.map((m, i) =>
    !m.first.trim()
      ? "Enter a first name."
      : m.role === "primary" && d.members.findIndex((x) => x.role === "primary") !== i
        ? "Only one primary member per household."
        : m.role === "spouse" && d.members.findIndex((x) => x.role === "spouse") !== i
          ? "Only one spouse per household."
          : "",
  );
  const noPrimary = d.members.some((m) => m.role === "primary") ? "" : "Mark one member as the primary.";
  const filers =
    d.filers.length === 0
      ? "Choose at least one filer."
      : (d.filing === "mfj" || d.filing === "mfs") && !hasSpouse
        ? "Add a spouse in the previous step to file as married."
        : d.filing === "mfj" && d.filers.length !== 2
          ? "Married filing jointly needs both spouses as filers."
          : d.filing === "hoh" && !hasDependent
            ? "Head of household needs a dependent. Add one in the previous step."
            : (d.filing === "single" || d.filing === "hoh") && d.filers.length !== 1
              ? "This filing status has one filer."
              : "";
  return { household, members, noPrimary, filers };
}

type InviteClientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: InviteDraft["mode"];
  taxYear: number;
  preparerName: string;
  onSubmit: (draft: InviteDraft) => Promise<void>;
  sample?: Omit<InviteDraft, "mode">; // demo only: "Fill sample data"
  onOpenReturn?: () => void; // shown on the done step
};

export function InviteClientDialog({ open, onOpenChange, mode, taxYear, preparerName, onSubmit, sample, onOpenReturn }: InviteClientDialogProps) {
  const [draft, setDraft] = React.useState<InviteDraft>(() => empty(mode));
  const [step, setStep] = React.useState(0);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const [tried, setTried] = React.useState<Record<number, boolean>>({});
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [sentAt, setSentAt] = React.useState<Date | null>(null);

  // A fresh start every time it opens.
  React.useEffect(() => {
    if (open) {
      setDraft(empty(mode));
      setStep(0);
      setTouched({});
      setTried({});
      setFailure(null);
      setSentAt(null);
    }
  }, [open, mode]);

  const isAdd = mode === "add";
  const e = errors(draft);
  const set = (p: Partial<InviteDraft>) => setDraft((d) => ({ ...d, ...p }));
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));
  const show = (k: string, msg: string) => ((tried[step] || touched[k]) && msg ? msg : "");
  const adults = draft.members.map((m, i) => ({ ...m, i })).filter((m) => m.role !== "dependent");
  const name = (i: number) => `${draft.members[i]?.first.trim() || "Unnamed"} ${draft.surname.trim()}`.trim();

  const stepValid = [
    !e.household.surname && !e.household.email && !e.household.phone,
    e.members.every((m) => !m) && !e.noPrimary,
    !e.filers,
    true,
  ];

  const next = async () => {
    setTried((t) => ({ ...t, [step]: true }));
    if (!stepValid[step]) return;
    if (step < 3) return setStep(step + 1);
    setBusy(true);
    setFailure(null);
    try {
      await onSubmit({ ...draft, surname: draft.surname.trim(), email: draft.email.trim(), phone: draft.phone.trim() });
      setSentAt(new Date());
      setStep(4);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const setFiling = (v: Filing) => {
    const firstTwo = adults.slice(0, 2).map((m) => m.i);
    touch("filers");
    set({ filing: v, filers: v === "mfj" || v === "mfs" ? firstTwo : [adults[0]?.i ?? 0] });
  };

  const titles = ["Create the household", "Add household members", `Choose this year's filers`, isAdd ? "Review and save" : "Send the portal invite", isAdd ? "Client added" : "Invite sent"];
  const descs = [
    isAdd ? "Start with a name. Email is optional until you send the portal invite." : "Start with a name and the email the invite goes to.",
    "Add everyone who lives in the household, including dependents. Clients add SSNs themselves in the portal.",
    `Pick the filing status for TY ${taxYear} and who files.`,
    isAdd ? "Check it over. Nothing is sent to the client." : "Check it over. This is what they'll get.",
    "",
  ];
  const returns = draft.filing === "mfs" ? draft.filers.length : 1;
  const filingLabel = FILINGS.find((f) => f.v === draft.filing)!.label;
  const stamp = sentAt?.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) ?? "";

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? null : onOpenChange(o))}>
      <DialogContent className="gap-5 sm:max-w-2xl">
        {step < 4 ? <StepList steps={["Household", "Members", "Filers", isAdd ? "Save" : "Send"]} current={step} className="pr-8" /> : null}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {step === 4 ? <CircleCheck aria-hidden="true" className="size-5 text-success-foreground" /> : null}
            {titles[step]}
          </DialogTitle>
          {descs[step] ? <DialogDescription>{descs[step]}</DialogDescription> : null}
        </DialogHeader>

        {step === 0 ? (
          <div className="grid gap-4">
            <FieldRow label="Household surname" error={show("surname", e.household.surname)}>
              {(p) => <Input {...p} autoFocus value={draft.surname} onChange={(ev) => set({ surname: ev.target.value })} onBlur={() => touch("surname")} placeholder="Example" />}
            </FieldRow>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label={isAdd ? "Email (optional for now)" : "Email for the invite"} error={show("email", e.household.email)}>
                {(p) => <Input {...p} type="email" inputMode="email" autoComplete="off" value={draft.email} onChange={(ev) => set({ email: ev.target.value })} onBlur={() => touch("email")} placeholder="m@example.com" />}
              </FieldRow>
              <FieldRow label="Mobile (optional)" error={show("phone", e.household.phone)}>
                {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="off" value={draft.phone} onChange={(ev) => set({ phone: ev.target.value })} onBlur={() => touch("phone")} placeholder="(555) 010-0000" />}
              </FieldRow>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-3">
            <ul className="grid gap-2" aria-label="Household members">
              {draft.members.map((m, i) => (
                <li key={i} className="grid gap-1.5">
                  <div className="flex items-start gap-2">
                    <FieldRow label={`First name, member ${i + 1}`} srLabel error={show(`m${i}`, e.members[i]!)} className="flex-1">
                      {(p) => (
                        <Input
                          {...p}
                          value={m.first}
                          autoFocus={i === draft.members.length - 1 && i > 0}
                          placeholder="First name"
                          onChange={(ev) => set({ members: draft.members.map((x, j) => (j === i ? { ...x, first: ev.target.value } : x)) })}
                          onBlur={() => touch(`m${i}`)}
                        />
                      )}
                    </FieldRow>
                    <Select value={m.role} onValueChange={(v) => set({ members: draft.members.map((x, j) => (j === i ? { ...x, role: v as Role } : x)) })}>
                      <SelectTrigger aria-label={`Role, member ${i + 1}`} className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${m.first.trim() || `member ${i + 1}`}`}
                      disabled={draft.members.length === 1}
                      onClick={() => set({ members: draft.members.filter((_, j) => j !== i), filers: draft.filers.filter((f) => f !== i).map((f) => (f > i ? f - 1 : f)) })}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {tried[1] && e.noPrimary ? <FieldError>{e.noPrimary}</FieldError> : null}
            <Button
              variant="outline"
              className="w-fit"
              onClick={() => set({ members: [...draft.members, { first: "", role: draft.members.some((m) => m.role === "spouse") ? "dependent" : "spouse" }] })}
            >
              <Plus /> Add someone
            </Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-5">
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Filing status</legend>
              <RadioGroup value={draft.filing} onValueChange={(v) => setFiling(v as Filing)} className="grid gap-2 sm:grid-cols-2">
                {FILINGS.map((f) => (
                  <RadioCard key={f.v} value={f.v}>
                    <span className="font-medium">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.desc}</span>
                  </RadioCard>
                ))}
              </RadioGroup>
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Who files</legend>
              {adults.map((m) => {
                const id = `filer-${m.i}`;
                return (
                  <div key={m.i} className="flex items-center gap-3">
                    <Checkbox
                      id={id}
                      checked={draft.filers.includes(m.i)}
                      onCheckedChange={(v) => {
                        touch("filers");
                        set({ filers: v ? [...draft.filers, m.i].sort() : draft.filers.filter((f) => f !== m.i) });
                      }}
                    />
                    <Label htmlFor={id} className="font-normal">
                      {name(m.i)} <span className="text-muted-foreground">· {ROLE_LABEL[m.role]}</span>
                    </Label>
                  </div>
                );
              })}
              {show("filers", e.filers) ? (
                <FieldError>{e.filers}</FieldError>
              ) : draft.filing === "mfs" ? (
                <p className="text-xs text-muted-foreground">
                  This creates {draft.filers.length} separate return{draft.filers.length === 1 ? "" : "s"}.
                </p>
              ) : null}
            </fieldset>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4">
            <dl className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted-foreground">Household</dt>
              <dd>{draft.surname.trim()} household</dd>
              <dt className="text-muted-foreground">{isAdd ? "Email" : "Invite goes to"}</dt>
              <dd>{draft.email.trim() || "Not added yet"}</dd>
              <dt className="text-muted-foreground">Members</dt>
              <dd>{draft.members.map((m) => `${m.first.trim()} (${ROLE_LABEL[m.role].toLowerCase()})`).join(", ")}</dd>
              <dt className="text-muted-foreground">TY {taxYear}</dt>
              <dd>
                {returns} return{returns === 1 ? "" : "s"} · {filingLabel} · {draft.filers.map(name).join(" and ")}
              </dd>
            </dl>
            {!isAdd ? (
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">The email they'll get</span>
                <p className="rounded-lg bg-muted p-4 text-sm leading-relaxed">
                  Hi {draft.members[0]?.first.trim() || "there"}, {preparerName} invited you to set up your BellTaxPrep account. You'll answer a few questions, upload your tax documents, and see where your return stands, all in one place.
                </p>
              </div>
            ) : null}
            {failure ? <Banner tone="danger" title="That didn't go through">{failure}</Banner> : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-2 text-sm">
            <p>
              {isAdd
                ? `${draft.surname.trim()} household added on ${stamp}. The return is in Invited and marked Not invited yet.`
                : `Invite sent to ${draft.email.trim()} on ${stamp}. The return is in Invited until they set up their account.`}
            </p>
            <p className="text-muted-foreground">
              {isAdd ? "Send the portal invite from the return's menu when you're ready." : "The link works once and expires in 7 days. You can resend it from the household page."}
            </p>
          </div>
        ) : null}

        <DialogFooter className="items-center sm:justify-between">
          <div className="flex gap-2">
            {step > 0 && step < 4 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={busy}>
                Back
              </Button>
            ) : null}
            {step === 0 && sample ? (
              <Button variant="ghost" onClick={() => setDraft({ ...sample, mode })}>
                Fill sample data
              </Button>
            ) : null}
          </div>
          {step < 4 ? (
            <Button onClick={next} disabled={busy}>
              {step < 3 ? "Continue" : busy ? (isAdd ? "Saving…" : "Sending…") : isAdd ? "Save client" : "Send invite"}
            </Button>
          ) : (
            <div className="flex gap-2">
              {onOpenReturn ? (
                <Button variant="outline" onClick={onOpenReturn}>
                  Open the return
                </Button>
              ) : null}
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// A label, a control and its error, wired together for screen readers.
function FieldRow({ label, error, srLabel, className, children }: { label: string; error?: string; srLabel?: boolean; className?: string; children: (p: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode }) {
  const id = React.useId();
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className={srLabel ? "sr-only" : undefined}>
        {label}
      </Label>
      {children({ id, ...(error ? { "aria-invalid": true as const, "aria-describedby": `${id}-e` } : {}) })}
      {error ? <FieldError id={`${id}-e`}>{error}</FieldError> : null}
    </div>
  );
}

function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-sm text-danger-foreground">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}
