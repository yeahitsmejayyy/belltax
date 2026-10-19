import { CheckCircle2, FolderOpen, Lock } from "lucide-react";
import { Link } from "react-router-dom";

import { Banner } from "@app/ui/components/banner";
import { Button } from "@app/ui/components/button";
import { formatDateTime } from "@app/ui/format";

import { AnswerSummary } from "./review";
import type { Answers } from "./rules";

// After the answers are sent, or once the return is past the questionnaire: what happens next. Sent answers aren't
// shown back (ticket 52, send-only portal): the preparer has them, and a stolen login can't read them. Only the
// preparer can reopen them.

type Props = { answers: Answers; submittedAt: string | null; preparer: string; replyTo?: string };

export function SentAnswers({ answers, submittedAt, preparer, replyTo }: Props) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        {submittedAt ? (
          <span className="flex size-12 items-center justify-center rounded-full bg-success-subtle text-success-foreground">
            <CheckCircle2 aria-hidden="true" className="size-6" />
          </span>
        ) : null}
        <div className="grid gap-2">
          <h1 tabIndex={-1} className="text-2xl font-semibold tracking-tight text-balance outline-none">
            {submittedAt ? `Your answers are with ${preparer}` : "Your answers"}
          </h1>
          <p className="text-pretty text-muted-foreground">
            {submittedAt
              ? `Sent ${formatDateTime(submittedAt)}. Thank you, that's the biggest part done.`
              : "This return is past the questions stage, so the answers can't be changed here."}
          </p>
        </div>
      </div>

      {submittedAt ? (
        <section aria-labelledby="next" className="grid gap-3">
          <h2 id="next" className="font-semibold">
            What happens next
          </h2>
          <ol className="grid list-decimal gap-2 pl-5 text-pretty marker:text-muted-foreground">
            <li>{preparer} reads through your answers, usually within a few days.</li>
            <li>Anything we need from you shows up under Documents, with a note saying why.</li>
            <li>We'll message you if a question needs a closer look.</li>
          </ol>
          <Button asChild className="mt-2 w-full sm:w-auto max-md:h-11 max-md:text-base">
            <Link to="/documents">
              <FolderOpen aria-hidden="true" /> Go to Documents
            </Link>
          </Button>
        </section>
      ) : null}

      <Banner tone="info" title="Need to change something?">
        {replyTo ? (
          <a className="font-medium underline underline-offset-4" href={`mailto:${replyTo}`}>
            Email {preparer}
          </a>
        ) : (
          `Tell ${preparer}`
        )}{" "}
        if something's wrong or missing. {preparer} can reopen your answers for you.
      </Banner>

      {submittedAt ? (
        <p className="flex items-start gap-2 text-sm text-pretty text-muted-foreground">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          For your privacy, answers aren't shown here once they're sent. {preparer} has them.
        </p>
      ) : (
        <AnswerSummary answers={answers} />
      )}
    </div>
  );
}
