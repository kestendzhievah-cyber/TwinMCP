// The one password rule for every screen that sets a password (sign-up and the
// reset form): at least 8 characters AND two of mixed case, a number, a symbol.
// The weak_password message in lib/auth/errors.ts states it in words.
//
// Pure and client-safe. The strength meter (components/auth/password-strength.tsx)
// scores the same four checks; src/__tests__/password-rule.test.ts keeps the
// two in step.

export const PASSWORD_MIN_LENGTH = 8;

/** Character-class checks; two of them are required on top of the length. */
export const PASSWORD_CLASS_CHECKS = {
  case: (pw: string) => /[a-z]/.test(pw) && /[A-Z]/.test(pw),
  number: (pw: string) => /\d/.test(pw),
  special: (pw: string) => /[^A-Za-z0-9]/.test(pw),
} as const;

export const PASSWORD_MIN_CLASSES = 2;

/** How many of the character-class checks the password passes (0-3). */
export function passwordClassCount(pw: string): number {
  return Object.values(PASSWORD_CLASS_CHECKS).reduce((n, test) => n + (test(pw) ? 1 : 0), 0);
}

/** True when the password meets the sign-up rule. */
export function passwordAccepted(pw: string): boolean {
  return pw.length >= PASSWORD_MIN_LENGTH && passwordClassCount(pw) >= PASSWORD_MIN_CLASSES;
}
