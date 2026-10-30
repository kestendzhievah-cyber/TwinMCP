import { describe, it, expect, afterEach } from "vitest";
import { emailDomain, hashEmail, normalizeEmail, signupHashPepper } from "./email-normalize";

describe("normalizeEmail", () => {
  it.each([
    ["Jane@Example.com", "jane@example.com"],
    ["  jane@example.com  ", "jane@example.com"],
    ["jane+promo@example.com", "jane@example.com"],
    ["jane+a+b@example.com", "jane@example.com"],
    ["j.a.n.e@example.com", "j.a.n.e@example.com"],
    ["J.a.N.e+x@Gmail.com", "jane@gmail.com"],
    ["jane.doe@googlemail.com", "janedoe@gmail.com"],
    ["jane.doe+spam@googlemail.com", "janedoe@gmail.com"],
    ["jane@example.com.", "jane@example.com"],
    ["jane+tag@outlook.fr", "jane@outlook.fr"],
    // Fullwidth characters fold under NFKC.
    ["ｊａｎｅ@example.com", "jane@example.com"],
  ])("%j → %j", (raw, expected) => {
    expect(normalizeEmail(raw)).toBe(expected);
  });

  it("folds every Gmail alias of one inbox to the same key", () => {
    const variants = [
      "johnsmith@gmail.com",
      "john.smith@gmail.com",
      "John.Smith+work@gmail.com",
      "j.o.h.n.s.m.i.t.h@googlemail.com",
    ];
    expect(new Set(variants.map(normalizeEmail)).size).toBe(1);
  });

  it("does not strip dots for non-Gmail domains", () => {
    expect(normalizeEmail("john.smith@yahoo.fr")).not.toBe(normalizeEmail("johnsmith@yahoo.fr"));
  });

  it("keeps the original when the +tag would leave an empty local part", () => {
    expect(normalizeEmail("+promo@example.com")).toBe("+promo@example.com");
  });

  it("returns malformed input lowercased and trimmed", () => {
    expect(normalizeEmail(" NoAt ")).toBe("noat");
    expect(normalizeEmail("@example.com")).toBe("@example.com");
    expect(normalizeEmail("jane@")).toBe("jane@");
  });
});

describe("emailDomain", () => {
  it("returns the lowercased domain, without a trailing dot", () => {
    expect(emailDomain("a@Mail.Example.COM.")).toBe("mail.example.com");
    expect(emailDomain("no-at")).toBe("");
  });
});

describe("hashEmail", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it("hashes the canonical form: aliases collide, other inboxes do not", () => {
    const p = "pepper";
    expect(hashEmail("John.Smith+x@gmail.com", p)).toBe(hashEmail("johnsmith@googlemail.com", p));
    expect(hashEmail("john@example.com", p)).not.toBe(hashEmail("jane@example.com", p));
  });

  it("is a 64-char hex HMAC that depends on the pepper", () => {
    const a = hashEmail("john@example.com", "one");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEmail("john@example.com", "two")).not.toBe(a);
  });

  it("uses SIGNUP_HASH_PEPPER, else CONFIG_ENCRYPTION_KEY", () => {
    process.env.SIGNUP_HASH_PEPPER = "explicit";
    process.env.CONFIG_ENCRYPTION_KEY = "fallback";
    expect(signupHashPepper()).toBe("explicit");
    delete process.env.SIGNUP_HASH_PEPPER;
    expect(signupHashPepper()).toBe("fallback");
    expect(hashEmail("john@example.com")).toBe(hashEmail("john@example.com", "fallback"));
  });
});
