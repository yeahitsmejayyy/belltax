import { z } from "zod";

export const Id = z.uuid();

// UTC ISO 8601 from now(); text order equals time order, which is why every writer must use it.
export const Timestamp = z.iso.datetime();
export const now = () => new Date().toISOString();

export const IsoDate = z.iso.date();
export const TaxYear = z.int().min(2000).max(2100);
export const Cents = z.int().positive();
export const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
export const SsnLast4 = z.string().regex(/^[0-9]{4}$/);
export const Json = z.string().refine((s) => {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}, "must be valid JSON");
