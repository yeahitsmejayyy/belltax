import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { IntakeAnswersV1, INTAKE_V1, isVisible, missingRequired, QUESTIONS } from "../packages/schema/src/intake/v1";
import { intakeDoc } from "./intake-doc";

describe("intake questionnaire v1", () => {
  test("question ids are unique and every condition points at an earlier question", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of QUESTIONS) if (q.showIf) expect({ q: q.id, before: ids.indexOf(q.showIf.question) < ids.indexOf(q.id) }).toEqual({ q: q.id, before: true });
  });

  test("partial answers are accepted; unknown questions and wrong shapes are refused", () => {
    expect(IntakeAnswersV1.safeParse({}).success).toBe(true);
    expect(IntakeAnswersV1.safeParse({ moved: true, moved_where: "into_ca" }).success).toBe(true);
    expect(IntakeAnswersV1.safeParse({ favourite_colour: "blue" }).success).toBe(false);
    expect(IntakeAnswersV1.safeParse({ moved: "yes" }).success).toBe(false);
    expect(IntakeAnswersV1.safeParse({ moved_where: "mars" }).success).toBe(false);
    expect(IntakeAnswersV1.safeParse({ income_types: [] }).success).toBe(false);
    expect(IntakeAnswersV1.safeParse({ income_types: ["wages", "wages"] }).success).toBe(false);
    expect(IntakeAnswersV1.safeParse({ estimated_payments_total: -5 }).success).toBe(false);
  });

  test("free text can't carry an SSN or an account number", () => {
    const text = (s: string) => IntakeAnswersV1.safeParse({ questions_for_preparer: s }).success;
    expect(text("We had a baby in March!")).toBe(true);
    expect(text(["My SSN is 900", "12", "3456"].join("-"))).toBe(false);
    expect(text("routing 1210004 account 0012345678")).toBe(false);
    expect(text(`ssn ${"9".repeat(9)}`)).toBe(false);
  });

  test("submit needs every required question that's visible; hidden ones are ignored", () => {
    const always = QUESTIONS.filter((q) => q.required && !q.showIf).map((q) => q.id);
    expect(missingRequired({}).map((q) => q.id)).toEqual(always);

    // Saying "yes" to moving reveals a required follow-up...
    const moved = missingRequired({ moved: true }).map((q) => q.id);
    expect(moved).toContain("moved_where");
    // ...and answering "no" hides it again, even if an old answer to it is still stored.
    const notMoved = missingRequired({ moved: false, moved_where: "into_ca" }).map((q) => q.id);
    expect(notMoved).not.toContain("moved_where");

    // Conditions chain: the dependents note only shows when there are dependents AND they changed.
    const note = QUESTIONS.find((q) => q.id === "dependents_note")!;
    expect(isVisible(note, { has_dependents: false, dependents_changed: true })).toBe(false);
    expect(isVisible(note, { has_dependents: true, dependents_changed: true })).toBe(true);

    // "includes" conditions on multi-choice questions.
    expect(missingRequired({ income_types: ["self_employment"] }).map((q) => q.id)).toContain("business_expenses");
  });

  test("never asks for a full SSN, IP PIN or bank numbers", () => {
    // Nothing that collects a value (text, amount, date) asks for one of these. A yes/no like
    // "Did the IRS send you an IP PIN?" is fine: it asks whether, not what.
    const collects = QUESTIONS.filter((q) => q.type === "text" || q.type === "money" || q.type === "date");
    for (const q of collects) {
      expect({ q: q.id, asks: /social security|ssn|ip pin|identity protection|account|routing/i.test(q.label) }).toEqual({ q: q.id, asks: false });
    }
    expect(QUESTIONS.find((q) => q.id === "has_ip_pin")!.help).toMatch(/Don't type the PIN here/);
    expect(QUESTIONS.find((q) => q.id === "refund_preference")!.help).toMatch(/never in this portal/);
  });

  test("docs/intake-v1.md is current (run `bun run intake:doc` if this fails)", () => {
    const committed = readFileSync(resolve(import.meta.dir, "../docs/intake-v1.md"), "utf8");
    expect(committed).toBe(intakeDoc());
    expect(committed).toContain("DRAFT");
    expect(INTAKE_V1.every((s) => committed.includes(`## ${s.title}`))).toBe(true);
  });
});
