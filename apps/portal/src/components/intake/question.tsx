import type { Question } from "@app/schema";
import { CircleAlert } from "lucide-react";

import { Checkbox } from "@app/ui/components/checkbox";
import { Input } from "@app/ui/components/input";
import { RadioCard, RadioGroup } from "@app/ui/components/radio-group";
import { Textarea } from "@app/ui/components/textarea";
import { cn } from "@app/ui/utils";

// One question, drawn by its type (portal 09-intake-intake-household): choices and yes/no as whole-row
// cards, several-of as checkbox rows, typed answers as fields. Label, help and the error sit together.

type Props = {
  q: Question;
  value: unknown;
  draft: string;
  error: string | null;
  onAnswer: (value: unknown) => void;
  onDraft: (raw: string) => void;
  onBlur: () => void;
};

export function QuestionField({ q, value, draft, error, onAnswer, onDraft, onBlur }: Props) {
  const base = `q-${q.id}`;
  const describedBy = [q.help ? `${base}-help` : null, error ? `${base}-error` : null].filter(Boolean).join(" ") || undefined;
  const aria = { "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, "aria-required": q.required || undefined };
  const grouped = q.type === "yes_no" || q.type === "choice" || q.type === "multi";

  const label = (
    <>
      {q.label}
      {!q.required ? <span className="ml-1.5 font-normal text-muted-foreground">(optional)</span> : null}
    </>
  );
  const after = (
    <>
      {q.help ? (
        <p id={`${base}-help`} className="text-sm text-pretty text-muted-foreground">
          {q.help}
        </p>
      ) : null}
      {error ? (
        <p id={`${base}-error`} className="flex items-start gap-1.5 text-sm text-danger-foreground">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </>
  );

  if (grouped) {
    return (
      <fieldset data-question={q.id} className="grid min-w-0 gap-3">
        <legend id={`${base}-label`} className="mb-3 text-base font-medium text-balance md:text-sm">
          {label}
        </legend>
        {q.type === "multi" ? (
          <div role="group" aria-labelledby={`${base}-label`} {...aria} className="grid gap-2">
            {q.options.map((o) => {
              const list = (value as string[] | undefined) ?? [];
              const checked = list.includes(o.value);
              return (
                <label
                  key={o.value}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent has-data-[state=checked]:border-primary has-data-[state=checked]:bg-brand-subtle max-md:text-base"
                >
                  <Checkbox
                    checked={checked}
                    onBlur={onBlur}
                    onCheckedChange={(c) => onAnswer(c ? [...list, o.value] : list.filter((x) => x !== o.value))}
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        ) : (
          <RadioGroup
            aria-labelledby={`${base}-label`}
            {...aria}
            value={q.type === "yes_no" ? (value === undefined ? "" : value ? "yes" : "no") : ((value as string | undefined) ?? "")}
            onValueChange={(v) => onAnswer(q.type === "yes_no" ? v === "yes" : v)}
            className={cn("gap-2", q.type === "yes_no" && "grid-cols-2")}
          >
            {(q.type === "yes_no" ? [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] : q.options).map((o) => (
              <RadioCard key={o.value} value={o.value}>
                {o.label}
              </RadioCard>
            ))}
          </RadioGroup>
        )}
        {after}
      </fieldset>
    );
  }

  const input = { id: base, value: draft, onBlur, ...aria, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onDraft(e.target.value) };
  return (
    <div data-question={q.id} className="grid min-w-0 gap-2">
      <label htmlFor={base} className="text-base font-medium text-balance md:text-sm">
        {label}
      </label>
      {q.type === "text" ? (
        <Textarea {...input} rows={3} maxLength={2000} className="min-h-24" />
      ) : q.type === "money" ? (
        <div className="relative max-w-xs">
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            $
          </span>
          <Input {...input} inputMode="decimal" autoComplete="off" className="pl-7 tabular-nums max-md:h-11" placeholder="0.00" />
        </div>
      ) : (
        <Input {...input} type="date" className="max-w-xs max-md:h-11" />
      )}
      {after}
    </div>
  );
}
