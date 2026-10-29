import { describe, it, expect } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  passwordAccepted,
  passwordClassCount,
} from "@/lib/auth/password-rule";
import { passwordScore } from "@/components/auth/password-strength";

describe("password rule (sign-up and reset share it)", () => {
  it("needs 8+ characters", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(passwordAccepted("Ab1!")).toBe(false);
    expect(passwordAccepted("Abcdef1")).toBe(false); // 7 chars, two classes
    expect(passwordAccepted("Abcdefg1")).toBe(true); // 8 chars, case + number
  });

  it("needs two of: mixed case, a number, a symbol", () => {
    expect(passwordAccepted("abcdefgh")).toBe(false);
    expect(passwordAccepted("ABCDEFGH")).toBe(false);
    expect(passwordAccepted("12345678")).toBe(false);
    expect(passwordAccepted("abcdefgH")).toBe(false); // case only
    expect(passwordAccepted("abcdefg1")).toBe(false); // number only
    expect(passwordAccepted("abcdefg!")).toBe(false); // symbol only
    expect(passwordAccepted("abcdef1!")).toBe(true); // number + symbol
    expect(passwordAccepted("Abcdefg!")).toBe(true); // case + symbol
    expect(passwordAccepted("Abcdef1!")).toBe(true); // all three
  });

  it("counts character classes", () => {
    expect(passwordClassCount("")).toBe(0);
    expect(passwordClassCount("aB")).toBe(1);
    expect(passwordClassCount("aB1")).toBe(2);
    expect(passwordClassCount("aB1 ")).toBe(3);
  });

  // The strength meter scores length + the same three classes: the rule must
  // stay exactly "length passed and meter score >= 3", the sign-up's former rule.
  it("matches the strength meter's score", () => {
    const samples = [
      "",
      "a",
      "abcdefgh",
      "Abcdefgh",
      "abcdefg1",
      "abcdefg!",
      "Abcdefg1",
      "Abc1!",
      "Abcdef1!",
      "12345678",
      "!!!!!!!!",
      "aaaaaaa1!",
      "ÉÉÉÉééé1",
    ];
    for (const pw of samples) {
      const meter = passwordScore(pw);
      expect(meter).toBe((pw.length >= 8 ? 1 : 0) + passwordClassCount(pw));
      expect(passwordAccepted(pw)).toBe(pw.length >= 8 && meter >= 3);
    }
  });
});
