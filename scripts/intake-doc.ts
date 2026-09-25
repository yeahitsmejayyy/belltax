// Writes docs/intake-v1.md from the questionnaire definition (packages/schema/src/intake/v1.ts), so the
// list PJ reviews against ProSeries is always exactly what the portal asks. Run: bun run intake:doc.
// intake.test.ts fails if the committed doc is out of date.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { INTAKE_V1, QUESTIONS, type Question } from "../packages/schema/src/intake/v1";

const TYPE: Record<Question["type"], string> = {
  yes_no: "yes / no",
  choice: "pick one",
  multi: "pick any",
  date: "date",
  money: "amount ($)",
  text: "free text",
};

export function intakeDoc(): string {
  const label = (id: string) => QUESTIONS.find((q) => q.id === id)!.label;
  const lines = [
    "# Intake questionnaire v1 — DRAFT",
    "",
    "Generated from `packages/schema/src/intake/v1.ts` by `bun run intake:doc`. Don't edit by hand.",
    "",
    "**For PJ:** check each question against what ProSeries asks. Mark anything missing, unclear or unnecessary,",
    "then we change `v1.ts` and regenerate. By design the portal never asks for a full SSN, an IP PIN or bank",
    "account numbers (WISP §V.1), and refuses free-text answers that look like one.",
    "",
    `${QUESTIONS.length} questions in ${INTAKE_V1.length} sections; ${QUESTIONS.filter((q) => q.required && !q.showIf).length} are always required, the rest only when shown or never.`,
    "",
  ];
  for (const s of INTAKE_V1) {
    lines.push(`## ${s.title}`, "");
    if (s.intro) lines.push(`_${s.intro}_`, "");
    lines.push("| Question | Answer | Required | Shown when |", "|---|---|---|---|");
    for (const q of s.questions) {
      const choices = "options" in q ? `<br>${q.options.map((o) => o.label).join(" · ")}` : "";
      const help = q.help ? `<br>_${q.help}_` : "";
      const when = q.showIf
        ? "equals" in q.showIf
          ? `"${label(q.showIf.question)}" is ${q.showIf.equals === true ? "yes" : q.showIf.equals === false ? "no" : q.showIf.equals}`
          : `"${label(q.showIf.question)}" includes ${q.showIf.includes}`
        : "always";
      lines.push(`| ${q.label}${help} | ${TYPE[q.type]}${choices} | ${q.required ? "yes" : "no"} | ${when} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

if (import.meta.main) {
  writeFileSync(resolve(import.meta.dir, "../docs/intake-v1.md"), intakeDoc());
  console.log("✔ docs/intake-v1.md");
}
