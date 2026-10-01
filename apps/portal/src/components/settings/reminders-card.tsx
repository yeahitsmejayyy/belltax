import type { ReminderKind, ReminderPref } from "@app/schema";
import { CircleAlert } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { Label } from "@app/ui/components/label";
import { Switch } from "@app/ui/components/switch";

import { trpc, type RouterOutputs } from "@/lib/trpc";

// Reminders (portal 21-…-settings): email and text per kind, saved as each switch flips.

type Me = RouterOutputs["me"]["get"];

const KINDS: Record<ReminderKind, string> = {
  requests: "Documents and questions",
  letter: "Your engagement letter",
  invoice: "Invoices and payments",
};

export function RemindersCard({ me }: { me: Me }) {
  const utils = trpc.useUtils();
  const [prefs, setPrefs] = React.useState<ReminderPref[]>(me.reminders);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => setPrefs(me.reminders), [me.reminders]);

  const save = trpc.me.setReminders.useMutation({
    onSuccess: (next) => {
      utils.me.get.setData(undefined, next);
      toast.success("Reminders saved");
    },
    onError: (e) => {
      setPrefs(me.reminders);
      setError(e.message);
    },
  });

  const flip = (kind: ReminderKind, channel: "email" | "text", on: boolean) => {
    const next = prefs.map((p) => (p.kind === kind ? { ...p, [channel]: on } : p));
    setPrefs(next);
    setError(null);
    save.mutate({ reminders: next });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Reminders</h2>
        </CardTitle>
        <CardDescription>We only send reminders when something is waiting on you.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="divide-y">
          {prefs.map((p) => (
            <li key={p.kind} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3 first:pt-0 last:pb-0">
              <span className="font-medium">{KINDS[p.kind]}</span>
              <span className="flex items-center gap-6">
                {(["email", "text"] as const).map((channel) => {
                  const id = `reminder-${p.kind}-${channel}`;
                  return (
                    <span key={channel} className="flex min-h-11 items-center gap-2">
                      <Switch
                        id={id}
                        checked={p[channel]}
                        disabled={save.isPending || (channel === "text" && !me.phone)}
                        onCheckedChange={(on) => flip(p.kind, channel, on)}
                      />
                      <Label htmlFor={id} className="min-h-11">
                        {channel === "email" ? "Email" : "Text"}
                      </Label>
                    </span>
                  );
                })}
              </span>
            </li>
          ))}
        </ul>
        {!me.phone ? <p className="text-sm text-muted-foreground">Add a mobile phone above to get reminders by text.</p> : null}
        {error ? (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-danger-foreground">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
