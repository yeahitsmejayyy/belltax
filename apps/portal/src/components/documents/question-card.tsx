import type { RequestView } from "@app/schema";
import { CircleAlert, MessageCircleQuestion } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@app/ui/components/button";
import { Textarea } from "@app/ui/components/textarea";

import { trpc } from "@/lib/trpc";

// A question from the preparer, answered in place (request.answer). Once answered it leaves this list.
export function QuestionCard({ request, preparer }: { request: RequestView; preparer: string }) {
  const utils = trpc.useUtils();
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const field = React.useRef<HTMLTextAreaElement>(null);
  const id = React.useId();
  const answer = trpc.request.answer.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.request.list.invalidate(), utils.engagement.mine.invalidate()]);
      toast.success(`Answer sent to ${preparer}`);
    },
    onError: (e) => setError(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError("Write your answer first.");
      field.current?.focus();
      return;
    }
    setError(null);
    answer.mutate({ requestId: request.id, response: value.trim() });
  };

  return (
    <li className="grid gap-3 p-4">
      <div className="flex gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-subtle text-info-foreground">
          <MessageCircleQuestion aria-hidden="true" className="size-5" />
        </span>
        <div className="grid min-w-0 gap-1">
          <p id={`${id}-q`} className="font-medium text-pretty">{request.title}</p>
          {request.note ? <p className="text-sm text-muted-foreground">{request.note}</p> : null}
        </div>
      </div>
      <form onSubmit={submit} className="grid gap-2 md:pl-14" noValidate>
        <label htmlFor={`${id}-a`} className="sr-only">
          Your answer
        </label>
        <Textarea
          ref={field}
          id={`${id}-a`}
          aria-describedby={[`${id}-q`, error ? `${id}-e` : null].filter(Boolean).join(" ")}
          aria-invalid={error ? true : undefined}
          placeholder="Your answer"
          maxLength={2000}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error && e.target.value.trim()) setError(null);
          }}
        />
        {error ? (
          <p id={`${id}-e`} role="alert" className="flex items-start gap-1.5 text-sm text-danger-foreground">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="outline" size="touch" className="w-full md:h-9 md:w-auto md:justify-self-end md:text-sm" disabled={answer.isPending}>
          {answer.isPending ? "Sending…" : "Send answer"}
        </Button>
      </form>
    </li>
  );
}
