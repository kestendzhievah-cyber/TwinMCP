import { describe, it, expect } from "vitest";
import {
  DISPOSABLE_EMAIL_DOMAINS,
  isDisposableDomain,
  isDisposableEmail,
} from "./disposable-domains";

describe("DISPOSABLE_EMAIL_DOMAINS", () => {
  it("is a few hundred lowercase, well-formed, unique domains", () => {
    expect(DISPOSABLE_EMAIL_DOMAINS.length).toBeGreaterThanOrEqual(300);
    expect(new Set(DISPOSABLE_EMAIL_DOMAINS).size).toBe(DISPOSABLE_EMAIL_DOMAINS.length);
    for (const d of DISPOSABLE_EMAIL_DOMAINS) {
      expect(d).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
    }
  });

  it("never lists a mainstream mailbox provider", () => {
    for (const real of [
      "gmail.com",
      "googlemail.com",
      "outlook.com",
      "outlook.fr",
      "hotmail.com",
      "hotmail.fr",
      "live.com",
      "yahoo.com",
      "yahoo.fr",
      "icloud.com",
      "me.com",
      "proton.me",
      "protonmail.com",
      "gmx.de",
      "gmx.fr",
      "orange.fr",
      "free.fr",
      "laposte.net",
      "sfr.fr",
      "wanadoo.fr",
      "abv.bg",
      "duck.com",
    ]) {
      expect(isDisposableDomain(real)).toBe(false);
    }
  });
});

describe("isDisposableDomain / isDisposableEmail", () => {
  it("matches listed domains, any case", () => {
    expect(isDisposableDomain("mailinator.com")).toBe(true);
    expect(isDisposableDomain("YOPMAIL.FR")).toBe(true);
    expect(isDisposableEmail("someone@Guerrillamail.com")).toBe(true);
  });

  it("matches subdomains of a listed domain", () => {
    expect(isDisposableDomain("inbox.mailinator.com")).toBe(true);
    expect(isDisposableDomain("a.b.c.10minutemail.com")).toBe(true);
    expect(isDisposableEmail("x@eu.trashmail.com.")).toBe(true);
  });

  it("does not match look-alikes or bare suffixes", () => {
    expect(isDisposableDomain("notmailinator.org")).toBe(false);
    expect(isDisposableDomain("mymailinator.com")).toBe(false);
    expect(isDisposableDomain("com")).toBe(false);
    expect(isDisposableDomain("fr.nf")).toBe(false);
    expect(isDisposableDomain("")).toBe(false);
    expect(isDisposableEmail("no-at-sign")).toBe(false);
    expect(isDisposableEmail("jane@example.com")).toBe(false);
  });
});
