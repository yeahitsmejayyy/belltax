import { describe, expect, test } from "bun:test";
import { checkPaths, checkText } from "./check-no-real-data";

describe("the no-real-data guard", () => {
  test("flags databases, backups, data folders, secrets and documents", () => {
    const bad = [
      "data/demo/belltaxprep.db",
      "apps/server/live.sqlite",
      "backups/belltaxprep-20270115T090000Z.btpbak",
      "uploads/0190a000-0000-7000-8000-000000000001.pdf",
      ".env",
      ".env.local",
      "apps/server/.env.production",
      "clients/w2-scan.PDF",
      "IMG_0412.HEIC",
    ];
    expect(checkPaths(bad).map((f) => f.file).sort()).toEqual([...new Set(bad)].sort());
  });

  test("leaves ordinary source alone", () => {
    const fine = [".env.example", "apps/server/src/db/migrate.ts", "apps/server/src/db/migrations/001-baseline.sql", "apps/admin/public/avatar.png", "docs/wisp.md"];
    expect(checkPaths(fine)).toEqual([]);
  });

  // Samples are assembled at runtime so this file never holds a real-shaped SSN itself (the guard scans it too).
  const ssn = (...parts: string[]) => parts.join("-");

  test("flags an SSN that could be real, but not the demo's 9xx ones or impossible ones", () => {
    expect(checkText("x.ts", `ssn: ${ssn("123", "45", "6789")}`)).toHaveLength(1);
    expect(checkText("x.ts", `a\nb\nssn ${ssn("512", "34", "1234")}`)[0]!.file).toBe("x.ts:3");
    for (const ok of ["900-12-3456", "999-99-9999", "000-12-3456", "666-12-3456", "123-00-4567", "123-45-0000", "555-0100", "2026-09-24"]) {
      expect({ ok, found: checkText("x.ts", ok) }).toEqual({ ok, found: [] });
    }
  });
});
