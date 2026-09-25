import { CircleAlert } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { Input } from "./input";

// Validation that behaves like a person (principles.md rule 10):
//  - a field checks itself when you leave it,
//  - once it has shown an error it re-checks as you type, so the error clears the moment it's fixed,
//  - everything checks again on submit.
// Errors sit under the field with an icon and a sentence saying what to do.

export type Validate = (value: string) => string | null; // the message, or null when fine

export function useFieldValidation(validate: Validate, initial = "") {
  const [value, setValue] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [live, setLive] = React.useState(false); // true once an error has been shown

  const check = React.useCallback(
    (v: string) => {
      const message = validate(v);
      setError(message);
      if (message) setLive(true);
      return message === null;
    },
    [validate],
  );

  return {
    value,
    error,
    setValue,
    /** Run on submit: shows the error if there is one; returns whether the field is valid. */
    validateNow: () => check(value),
    inputProps: {
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
        if (live) check(e.target.value);
      },
      onBlur: () => check(value),
    },
  };
}

type FieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  label: string;
  hint?: string;
  error?: string | null;
  id?: string;
};

export function Field({ label, hint, error, id, className, ...input }: FieldProps) {
  const auto = React.useId();
  const inputId = id ?? auto;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div data-slot="field" className={cn("grid gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <Input id={inputId} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className="max-md:h-11" {...input} />
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-danger-foreground">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
