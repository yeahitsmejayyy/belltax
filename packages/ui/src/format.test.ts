import { expect, test } from "bun:test";

import { daysSince, formatCents, relativeDays } from "./format";

test("money is cents in, dollars out", () => {
  expect(formatCents(277000)).toBe("$2,770.00");
  expect(formatCents(0)).toBe("$0.00");
  expect(formatCents(8500)).toBe("$85.00");
  expect(formatCents(-2500)).toBe("-$25.00");
});

test("days in stage count whole days and never go negative", () => {
  const now = new Date("2026-09-23T17:00:00.000Z");
  expect(daysSince("2026-09-23T09:00:00.000Z", now)).toBe(0);
  expect(daysSince("2026-09-22T16:00:00.000Z", now)).toBe(1);
  expect(daysSince("2026-09-11T17:00:00.000Z", now)).toBe(12);
  expect(daysSince("2026-09-24T17:00:00.000Z", now)).toBe(0);
  expect(relativeDays("2026-09-20T17:00:00.000Z", now)).toBe("3 days ago");
});
