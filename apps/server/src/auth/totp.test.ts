import { describe, expect, test } from "bun:test";
import { base32Decode, base32Encode, hotp, matchTotp, newTotpSecret, otpauthUri, STEP_SECONDS, stepAt } from "./totp";

// Ticket 05b: the hand-rolled TOTP, checked against the RFCs' own test vectors.

const ascii = (s: string) => new TextEncoder().encode(s);

describe("HOTP (RFC 4226, appendix D)", () => {
  test("the ten published codes", () => {
    const key = ascii("12345678901234567890");
    const want = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expect(want.map((_, i) => hotp(key, i))).toEqual(want);
  });
});

describe("TOTP (RFC 6238, appendix B)", () => {
  // Each algorithm has its own seed in the RFC: 20, 32 and 64 bytes.
  const seeds = {
    sha1: ascii("12345678901234567890"),
    sha256: ascii("12345678901234567890123456789012"),
    sha512: ascii("1234567890123456789012345678901234567890123456789012345678901234"),
  };
  const vectors: [number, string, string, string][] = [
    [59, "94287082", "46119246", "90693936"],
    [1111111109, "07081804", "68084774", "25091201"],
    [1111111111, "14050471", "67062674", "99943326"],
    [1234567890, "89005924", "91819424", "93441116"],
    [2000000000, "69279037", "90698825", "38618901"],
    [20000000000, "65353130", "77737706", "47863826"],
  ];
  test.each(vectors)("at %d seconds", (seconds, sha1, sha256, sha512) => {
    const step = Math.floor(seconds / STEP_SECONDS);
    expect(hotp(seeds.sha1, step, 8, "sha1")).toBe(sha1);
    expect(hotp(seeds.sha256, step, 8, "sha256")).toBe(sha256);
    expect(hotp(seeds.sha512, step, 8, "sha512")).toBe(sha512);
  });
});

describe("base32 (RFC 4648)", () => {
  test("round-trips, and matches the published examples", () => {
    expect(base32Encode(ascii("foobar"))).toBe("MZXW6YTBOI");
    expect(new TextDecoder().decode(base32Decode("MZXW6YTBOI"))).toBe("foobar");
    expect(new TextDecoder().decode(base32Decode("mzxw 6ytb-oi"))).toBe("foobar"); // forgiving of how people type it
    const secret = newTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });
});

describe("checking a code", () => {
  const secret = newTotpSecret();
  const at = Date.UTC(2027, 0, 15, 12, 0, 10);
  const codeFor = (ms: number) => hotp(base32Decode(secret), stepAt(ms));

  test("the current code, and one step either side, are accepted", () => {
    expect(matchTotp(secret, codeFor(at), at)).toBe(stepAt(at));
    expect(matchTotp(secret, codeFor(at - 30_000), at)).toBe(stepAt(at) - 1);
    expect(matchTotp(secret, codeFor(at + 30_000), at)).toBe(stepAt(at) + 1);
    expect(matchTotp(secret, codeFor(at).replace(/^(\d{3})/, "$1 "), at)).toBe(stepAt(at)); // "123 456"
  });

  test("an old code, a wrong code, and junk are refused", () => {
    expect(matchTotp(secret, codeFor(at - 90_000), at)).toBeNull();
    expect(matchTotp(secret, codeFor(at) === "000000" ? "111111" : "000000", at)).toBeNull();
    expect(matchTotp(secret, "12345", at)).toBeNull();
    expect(matchTotp(secret, "abcdef", at)).toBeNull();
  });

  test("a code can't be used twice", () => {
    const step = matchTotp(secret, codeFor(at), at)!;
    expect(matchTotp(secret, codeFor(at), at, step)).toBeNull();
  });

  test("the QR code's address names the practice and the account", () => {
    expect(otpauthUri("ABC", "pat@example.test", "Bell Tax")).toBe(
      "otpauth://totp/Bell%20Tax%3Apat%40example.test?secret=ABC&issuer=Bell%20Tax&algorithm=SHA1&digits=6&period=30",
    );
  });
});
