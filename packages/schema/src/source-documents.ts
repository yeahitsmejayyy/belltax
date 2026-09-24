import type { SourceKind } from "./enums";

// What each kind of source usually produces each year. Codes are document_kinds rows.
// Drives the returning-client checklist (expected_documents → requests) and the demo seed.
export const SOURCE_DOCUMENT_KINDS: Record<SourceKind, readonly string[]> = {
  employer: ["w2"],
  ihss_provider: ["w2", "ihss_paystub"],
  brokerage: ["1099_b", "1099_div"],
  bank: ["1099_int"],
  retirement: ["1099_r", "ssa_1099"],
  rental_property: ["rent_ledger", "property_tax", "1098"],
  business: ["1099_nec", "expense_summary"],
  other: ["other"],
};
