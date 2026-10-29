import { describe, it, expect } from "vitest";
import { AUTH_PATHS, authFailurePath, authLocaleParam, authPath } from "@/lib/i18n/auth-paths";
import { TRANSLATED_TWINS, localizedPath } from "@/lib/i18n/locales";
import { localeSwitchTargets } from "@/lib/i18n/switch";
import { friendlyAuthError } from "@/lib/auth/errors";
import { proIntentQuery } from "@/lib/auth/return-to";

describe("authPath", () => {
  it("maps every auth screen to its French slug", () => {
    expect(authPath("signIn")).toBe("/sign-in");
    expect(authPath("signIn", "fr")).toBe("/fr/connexion");
    expect(authPath("signUp", "fr")).toBe("/fr/inscription");
    expect(authPath("forgotPassword", "fr")).toBe("/fr/mot-de-passe-oublie");
    expect(authPath("resetPassword", "fr")).toBe("/fr/nouveau-mot-de-passe");
  });

  it("appends a query and drops empty values", () => {
    expect(authPath("forgotPassword", "en", { email: "a+b@x.fr" })).toBe(
      "/forgot-password?email=a%2Bb%40x.fr"
    );
    expect(authPath("signIn", "fr", { email: "", returnTo: null })).toBe("/fr/connexion");
    expect(authPath("signIn", "fr", new URLSearchParams("plan=pro&cadence=yearly"))).toBe(
      "/fr/connexion?plan=pro&cadence=yearly"
    );
  });

  it("is registered as a translated twin for the switcher and hreflang", () => {
    for (const paths of Object.values(AUTH_PATHS)) {
      expect(TRANSLATED_TWINS).toContainEqual({ en: paths.en, fr: paths.fr });
      expect(localizedPath(paths.en, "fr")).toBe(paths.fr);
      expect(localizedPath(paths.fr, "en")).toBe(paths.en);
    }
  });
});

describe("authFailurePath", () => {
  it("sends a French link failure to the French sign-in", () => {
    expect(authFailurePath({ errorCode: "otp_expired", locale: "fr" })).toBe(
      "/fr/connexion?error=otp_expired"
    );
    expect(authFailurePath({ errorCode: "otp_expired" })).toBe("/sign-in?error=otp_expired");
  });

  it("keeps the destination and the Pro intent", () => {
    const path = authFailurePath({
      errorCode: "access_denied",
      locale: "fr",
      returnTo: "/dashboard/servers",
      intentQuery: proIntentQuery({ cadence: "yearly", promo: "creator-x" }),
    });
    expect(path.startsWith("/fr/connexion?")).toBe(true);
    const q = new URLSearchParams(path.split("?")[1]);
    expect(q.get("error")).toBe("access_denied");
    expect(q.get("returnTo")).toBe("/dashboard/servers");
    expect(q.get("plan")).toBe("pro");
    expect(q.get("cadence")).toBe("yearly");
    expect(q.get("promo")).toBe("creator-x");
  });

  it("reads only fr as French", () => {
    expect(authLocaleParam("fr")).toBe("fr");
    expect(authLocaleParam("en")).toBe("en");
    expect(authLocaleParam("de")).toBe("en");
    expect(authLocaleParam(null)).toBe("en");
  });
});

describe("localeSwitchTargets", () => {
  it("links translated slugs both ways", () => {
    const pairs: Array<[string, string]> = [
      ["/plans", "/fr/tarifs"],
      ["/sign-up", "/fr/inscription"],
      ["/migrate-from-smithery", "/fr/migrer-depuis-smithery"],
      ["/sign-in", "/fr/connexion"],
    ];
    for (const [en, fr] of pairs) {
      expect(localeSwitchTargets(en)).toEqual({ en, fr });
      expect(localeSwitchTargets(fr)).toEqual({ en, fr });
      expect(localeSwitchTargets(`${en}/`)).toEqual({ en, fr });
    }
  });

  it("flips the /fr prefix for plain twins", () => {
    expect(localeSwitchTargets("/")).toEqual({ en: "/", fr: "/fr" });
    expect(localeSwitchTargets("/fr")).toEqual({ en: "/", fr: "/fr" });
    expect(localeSwitchTargets("/fr/docs")).toEqual({ en: "/docs", fr: "/fr/docs" });
  });

  it("hides when a version is missing", () => {
    expect(localeSwitchTargets("/dashboard")).toBeNull();
    expect(localeSwitchTargets("/blog/some-english-only-post")).toBeNull();
  });
});

describe("friendlyAuthError for callback codes", () => {
  it("explains a link opened in another browser, in both languages", () => {
    expect(friendlyAuthError({ message: "", code: "bad_code_verifier" })).toMatch(
      /different browser/
    );
    expect(friendlyAuthError({ message: "", code: "flow_state_not_found" }, "fr")).toMatch(
      /autre navigateur/
    );
    expect(friendlyAuthError({ message: "", code: "otp_expired" }, "fr")).toMatch(/expiré/);
  });
});
