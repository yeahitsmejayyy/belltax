import { describe, expect, test } from "bun:test";
import { sitePage } from "./page";

// Ticket 53: which page the site shows.

describe("sitePage", () => {
  test("the deploy setting decides, landing by default", () => {
    expect(sitePage("", undefined)).toBe("landing");
    expect(sitePage("", "splash")).toBe("splash");
    expect(sitePage("", "landing")).toBe("landing");
    expect(sitePage("", "something-else")).toBe("landing");
  });
  test("?page= previews the other one, and junk is ignored", () => {
    expect(sitePage("?page=landing", "splash")).toBe("landing");
    expect(sitePage("?page=splash", undefined)).toBe("splash");
    expect(sitePage("?page=admin", "splash")).toBe("splash");
  });
});
