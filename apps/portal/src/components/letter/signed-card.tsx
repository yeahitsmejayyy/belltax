import type { LetterView } from "@app/schema";
import { Check, CheckCircle2, Clock } from "lucide-react";

import { StatusChip } from "@app/ui/components/status-chip";
import { formatDate } from "@app/ui/format";

// After signing (portal 16): who signed, when, in the viewer's time zone, and who still has to.

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const first = (name: string) => name.split(/\s+/)[0]!;

export function SignedCard({ letter, me }: { letter: LetterView; me: LetterView["signers"][number] }) {
  const others = letter.signers.filter((s) => !s.isMe);
  const waiting = others.filter((s) => !s.signedAt);
  return (
    <div className="grid max-w-xl gap-6">
      <div className="grid gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
          <Check aria-hidden="true" className="size-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Letter signed</h1>
        <p className="text-muted-foreground">
          {waiting.length
            ? `Thanks. The letter is complete once ${waiting.map((s) => first(s.name)).join(" and ")} signs too.`
            : "Thanks. Everyone has signed, so your preparer can get started."}
        </p>
      </div>
      <dl className="divide-y overflow-hidden rounded-xl border bg-card">
        {[
          ["Signed by", me.name],
          ["Date", formatDate(me.signedAt!, { month: "long", day: "numeric", year: "numeric" })],
          ["Time", time(me.signedAt!)],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {others.length ? (
        <ul aria-label="Other signers" className="grid gap-2">
          {others.map((s) => (
            <li key={s.personId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{s.signedAt ? `${s.name} signed on ${formatDate(s.signedAt, { month: "long", day: "numeric" })}` : `Waiting for ${first(s.name)} to sign`}</span>
              {s.signedAt ? <StatusChip tone="success" icon={CheckCircle2} label="Signed" /> : <StatusChip tone="neutral" icon={Clock} label="Not signed yet" />}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
