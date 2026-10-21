import { CircleAlert, Check } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Input } from "./input";

// "Join the list" (the splash page, ticket 53): an email, an optional yes to deadline reminders, and a confirmation in
// place of the form. Presentational: `onJoin` decides what joining means (today the site opens a pre-written email to
// the practice; nothing is stored). Errors follow principles.md rule 10: on leaving the field, live once shown, and
// everything again on submit. If `onJoin` throws, its message shows under the form.

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const problem = (v: string) => (!v.trim() ? "Enter your email address." : !isEmail(v) ? "Enter a valid email, like m@example.com." : null);

export function WaitlistForm({
  onJoin,
  joinLabel = "Join the list",
  pendingLabel = "Joining…",
  remindersLabel = "Also remind me about tax deadlines. One or two emails a season.",
  note = "No spam. Unsubscribe any time.",
  confirmation,
  className,
}: {
  onJoin: (email: string, reminders: boolean) => void | Promise<void>;
  joinLabel?: string;
  pendingLabel?: string;
  remindersLabel?: React.ReactNode;
  note?: React.ReactNode;
  /** What shows once they've joined. Defaults to "You're on the list." */
  confirmation?: (email: string) => { title: React.ReactNode; body: React.ReactNode };
  className?: string;
}) {
  const id = React.useId();
  const [email, setEmail] = React.useState("");
  const [reminders, setReminders] = React.useState(true);
  const [shown, setShown] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [joined, setJoined] = React.useState<string | null>(null);
  const error = shown ? problem(email) : null;
  const message = error ?? failed;

  if (joined) {
    const c = confirmation?.(joined) ?? { title: "You're on the list.", body: `We'll email ${joined} when booking opens. Nothing else.` };
    return (
      <div data-slot="waitlist-joined" role="status" className={cn("flex w-full max-w-120 items-start gap-3.5 rounded-2xl border bg-card px-5 py-4.5 text-left text-card-foreground animate-in fade-in-0 zoom-in-95", className)}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check aria-hidden="true" className="size-4.5" />
        </span>
        <span className="grid min-w-0 gap-1">
          <span className="font-semibold">{c.title}</span>
          <span className="text-sm text-pretty text-muted-foreground [overflow-wrap:anywhere]">{c.body}</span>
          <Button
            variant="link"
            className="h-auto justify-self-start p-0 text-sm text-foreground"
            onClick={() => {
              setJoined(null);
              setEmail("");
              setShown(false);
            }}
          >
            Use a different email
          </Button>
        </span>
      </div>
    );
  }

  return (
    <form
      data-slot="waitlist-form"
      noValidate
      className={cn("grid w-full max-w-120 gap-2.5 text-left", className)}
      onSubmit={async (e) => {
        e.preventDefault();
        setShown(true);
        if (problem(email) || pending) return;
        setPending(true);
        setFailed(null);
        try {
          await onJoin(email.trim(), reminders);
          setJoined(email.trim());
        } catch (err) {
          setFailed(err instanceof Error ? err.message : "That didn't work. Try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label htmlFor={`${id}-email`} className="sr-only">
        Email address
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="m@example.com"
          value={email}
          aria-invalid={!!error}
          aria-describedby={`${id}-msg`}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => email && setShown(true)}
          className="h-12 min-w-0 rounded-full px-5 text-base sm:flex-1 md:text-base"
        />
        <Button type="submit" disabled={pending} aria-busy={pending} className="h-12 rounded-full px-6 text-base">
          {pending ? pendingLabel : joinLabel}
        </Button>
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 py-0.5 text-sm text-muted-foreground">
        <Checkbox checked={reminders} onCheckedChange={(v) => setReminders(v === true)} className="mt-0.5" />
        <span>{remindersLabel}</span>
      </label>
      {message ? (
        <span id={`${id}-msg`} role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          {message}
        </span>
      ) : (
        <span id={`${id}-msg`} className="text-[13px] text-muted-foreground">
          {note}
        </span>
      )}
    </form>
  );
}
