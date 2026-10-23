import { INTAKE_V1 } from "@app/schema";

import { ReturnIntake } from "@app/ui/components/return-intake";

import type { Detail } from "./shared";

// Intake (admin 13-return-detail-return-intake): the client's answers, read-only, section by section. The tab is
// ReturnIntake from the design system, fed the questionnaire (INTAKE_V1) and this return's answers.

export function IntakeTab({ d }: { d: Detail }) {
  return <ReturnIntake sections={INTAKE_V1} intake={d.intake} />;
}
