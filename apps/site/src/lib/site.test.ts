import { describe, expect, test } from "bun:test";
import { joinHref } from "./join";
import { sitePage } from "./page";

// Ticket 53: which page the site shows, and what "Join the list" writes.

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

describe("joinHref", () => {
  test("a pre-written email to the practice, with the reminder line only when asked", () => {
    const href = joinHref("hello@belltax.example", "jordan@example.com", true);
    expect(href).toStartWith("mailto:hello@belltax.example?subject=Add%20me%20to%20the%20list&body=");
    const body = decodeURIComponent(href.split("&body=")[1]!);
    expect(body).toBe("Please add jordan@example.com to the belltax. list for when booking opens.\n\nAlso remind me about tax deadlines.");
    expect(decodeURIComponent(joinHref("hello@belltax.example", "jordan@example.com", false).split("&body=")[1]!)).not.toContain("remind");
  });
  test("an address can't add headers to the email", () => {
    const href = joinHref("hello@belltax.example", "x@example.com&cc=evil@example.com", false);
    expect(href.split("?")[1]!.split("&").map((p) => p.split("=")[0])).toEqual(["subject", "body"]);
  });
});
