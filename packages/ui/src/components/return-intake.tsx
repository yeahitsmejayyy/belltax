import type { Question, Section } from "@app/schema";
import { ClipboardList } from "lucide-react";

import { formatDate, formatDateTime } from "../format";
import { cn } from "../utils";
import { Banner } from "./banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { EmptyState } from "./empty-state";
import { visibleIn, type Answers } from "./intake";

// A return's Intake tab (admin 13-return-detail-return-intake), the piece apps/admin renders and Storybook shows
// (ticket 59): the client's answers, read-only, section by section, in the questionnaire's own words. Only the
// questions the client could see are shown. The questionnaire comes in as data (`sections`; the admin passes INTAKE_V1).

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** An answer in the preparer's words: labels for choices, dollars and cents for money. Null when there's none. */
export function answerInWords(q: Question, v: unknown): string | null {
  if (v === undefined || v === null) return null;
  switch (q.type) {
    case "yes_no":
      return v ? "Yes" : "No";
    case "choice":
      return q.options.find((o) => o.value === v)?.label ?? String(v);
    case "multi":
      return Array.isArray(v) ? v.map((x) => q.options.find((o) => o.value === x)?.label ?? String(x)).join(", ") : String(v);
    case "date":
      return formatDate(`${String(v)}T12:00:00Z`);
    case "money":
      return typeof v === "number" ? dollars.format(v) : String(v);
    case "text":
      return String(v);
  }
}

/** The client's intake as the server returns it: answers so far, when saved and sent, and the required ones still open. */
export type ReturnIntakeData = { formVersion: number; answers: Answers; updatedAt: string; submittedAt: string | null; missing: readonly string[] };

/** The Intake tab: none yet, or each section's visible questions and answers. */
export function ReturnIntake({ sections, intake }: { sections: readonly Section[]; intake: ReturnIntakeData | null | undefined }) {
  if (!intake) {
    return <EmptyState icon={ClipboardList} title="No intake answers yet" description="The client hasn't started the questionnaire." />;
  }
  const answers = intake.answers;
  const isVisible = visibleIn(sections);
  return (
    <div className="grid max-w-3xl gap-4">
      {intake.submittedAt ? (
        <p className="text-sm text-muted-foreground">Submitted {formatDateTime(intake.submittedAt)} · version {intake.formVersion}</p>
      ) : (
        <Banner tone="info" title="Not submitted yet">
          Last saved {formatDateTime(intake.updatedAt)}. {intake.missing.length ? `${intake.missing.length} required question${intake.missing.length === 1 ? "" : "s"} still unanswered.` : ""}
        </Banner>
      )}
      {sections.map((s) => {
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
                  const a = answerInWords(q, answers[q.id]);
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
