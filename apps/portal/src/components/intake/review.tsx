import { INTAKE_V1, isVisible } from "@app/schema";
import { CircleAlert } from "lucide-react";

import { Button } from "@app/ui/components/button";
import { Card } from "@app/ui/components/card";

import { inWords, type Answers } from "./rules";

// Every answer in words, grouped by section (portal 12-intake-intake-review). With onEdit each section
// links back to its step; without it this is the read-only copy shown once the answers are sent.

export function AnswerSummary({ answers, onEdit }: { answers: Answers; onEdit?: (sectionIndex: number) => void }) {
  return (
    <Card className="gap-0 divide-y py-0">
      {INTAKE_V1.map((s, i) => (
        <section key={s.id} aria-labelledby={`review-${s.id}`} className="grid gap-4 px-4 py-5 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id={`review-${s.id}`} className="font-semibold text-balance">
              {s.title}
            </h2>
            {onEdit ? (
              <Button variant="ghost" className="-my-2 -mr-3 min-h-11 text-primary hover:text-primary" onClick={() => onEdit(i)}>
                Edit<span className="sr-only"> {s.title.toLowerCase()}</span>
              </Button>
            ) : null}
          </div>
          <dl className="grid gap-4">
            {s.questions
              .filter((q) => isVisible(q, answers))
              .map((q) => {
                const v = answers[q.id];
                const empty = v === undefined || (Array.isArray(v) && v.length === 0);
                return (
                  <div key={q.id} className="grid gap-1">
                    <dt className="text-sm text-pretty text-muted-foreground">{q.label}</dt>
                    <dd className="text-pretty break-words whitespace-pre-line">
                      {!empty ? (
                        inWords(q, v)
                      ) : q.required ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-danger-foreground">
                          <CircleAlert aria-hidden="true" className="size-4 shrink-0" /> Still to answer
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not answered</span>
                      )}
                    </dd>
                  </div>
                );
              })}
          </dl>
        </section>
      ))}
    </Card>
  );
}
