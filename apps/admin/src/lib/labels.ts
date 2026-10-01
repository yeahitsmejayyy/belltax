import type { FilingStatus, Stage } from "@app/schema";
import { STAGE_META } from "@app/ui/components/stage-pill";

// Words the admin shows for the schema's values. Stage labels come from the design system (StagePill).
export const stageLabel = (s: Stage) => STAGE_META[s].label;

export const FILING_LABEL: Record<FilingStatus, string> = {
  single: "Single",
  mfj: "Married filing jointly",
  mfs: "Married filing separately",
  hoh: "Head of household",
  qss: "Qualifying surviving spouse",
};
export const FILING_SHORT: Record<FilingStatus, string> = { single: "Single", mfj: "MFJ", mfs: "MFS", hoh: "HOH", qss: "QSS" };
