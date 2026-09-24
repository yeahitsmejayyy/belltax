import { z } from "zod";
import { EngagementKind, FilingStatus, Stage } from "./enums";
import { Id, TaxYear, Timestamp } from "./primitives";

// Shapes that cross the wire. The server validates outputs against these, so the web app can trust them.

export const EngagementListInput = z
  .object({
    taxYear: TaxYear.optional(),
    stage: Stage.optional(),
    search: z.string().trim().max(100).optional(),
  })
  .optional();
export type EngagementListInput = z.infer<typeof EngagementListInput>;

export const PipelineRow = z.object({
  engagementId: Id,
  householdId: Id,
  householdName: z.string(),
  taxYear: TaxYear,
  kind: EngagementKind,
  filingStatus: FilingStatus.nullable(),
  stage: Stage,
  stageChangedAt: Timestamp,
  daysInStage: z.int().nonnegative(),
  filers: z.array(z.string()),
  openRequests: z.int().nonnegative(),
  balanceCents: z.int(),
  complexity: z.enum(["simple", "involved"]),
});
export type PipelineRow = z.infer<typeof PipelineRow>;

export const EngagementList = z.object({
  taxYear: TaxYear.nullable(),
  years: z.array(TaxYear), // newest first, for the tax year switcher
  counts: z.record(Stage, z.int().nonnegative()), // per stage, before the stage filter: the board's column headers
  rows: z.array(PipelineRow), // board order: by stage, then longest-waiting first
});
export type EngagementList = z.infer<typeof EngagementList>;
