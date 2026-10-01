import { INTAKE_V1, isVisible, type Question } from "@app/schema";
import { ClipboardList } from "lucide-react";

import { Banner } from "@app/ui/components/banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@app/ui/components/card";
import { EmptyState } from "@app/ui/components/empty-state";
import { formatDate, formatDateTime } from "@app/ui/format";
import { cn } from "@app/ui/utils";

import { dayIso, type Detail } from "./shared";

// Intake (admin 13-return-detail-return-intake): the client's answers, read-only, section by section, in the
// questionnaire's own words. Only the questions the client could see are shown.

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function inWords(q: Question, v: unknown): string | null {
  if (v === undefined || v === null) return null;
  switch (q.type) {
    case "yes_no":
      return v ? "Yes" : "No";
    case "choice":
      return q.options.find((o) => o.value === v)?.label ?? String(v);
    case "multi":
      return Array.isArray(v) ? v.map((x) => q.options.find((o) => o.value === x)?.label ?? String(x)).join(", ") : String(v);
    case "date":
      return formatDate(dayIso(String(v)));
    case "money":
      return typeof v === "number" ? dollars.format(v) : String(v);
    case "text":
      return String(v);
  }
}

export function IntakeTab({ d }: { d: Detail }) {
  const intake = d.intake;
  if (!intake) {
    return <EmptyState icon={ClipboardList} title="No intake answers yet" description="The client hasn't started the questionnaire." />;
  }
  const answers = intake.answers as Record<string, unknown>;
  return (
    <div className="grid max-w-3xl gap-4">
      {intake.submittedAt ? (
        <p className="text-sm text-muted-foreground">Submitted {formatDateTime(intake.submittedAt)} · version {intake.formVersion}</p>
      ) : (
        <Banner tone="info" title="Not submitted yet">
          Last saved {formatDateTime(intake.updatedAt)}. {intake.missing.length ? `${intake.missing.length} required question${intake.missing.length === 1 ? "" : "s"} still unanswered.` : ""}
        </Banner>
      )}
      {INTAKE_V1.map((s) => {
        const visible = s.questions.filter((q) => isVisible(q, answers));
        if (!visible.length) return null;
        return (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle>{s.title}</CardTitle>
              {s.intro ? <CardDescription>{s.intro}</CardDescription> : null}
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4">
                {visible.map((q) => {
                  const a = inWords(q, answers[q.id]);
                  return (
                    <div key={q.id} className="grid gap-1 sm:grid-cols-[1fr_minmax(0,16rem)] sm:gap-6">
                      <dt className="text-sm text-muted-foreground">{q.label}</dt>
                      <dd className={cn("text-sm font-medium break-words", !a && "font-normal text-muted-foreground italic")}>{a ?? "Not answered"}</dd>
                    </div>
                  );
                })}
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
