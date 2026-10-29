import { describe, it, expect } from "vitest";
import { authSwitchTargets } from "@/lib/i18n/auth-switch";

describe("authSwitchTargets", () => {
  it("pairs each switchable auth screen with its translated twin", () => {
    expect(authSwitchTargets("/sign-in")).toEqual({ en: "/sign-in", fr: "/fr/connexion" });
    expect(authSwitchTargets("/fr/inscription")).toEqual({ en: "/sign-up", fr: "/fr/inscription" });
    expect(authSwitchTargets("/forgot-password")).toEqual({
      en: "/forgot-password",
      fr: "/fr/mot-de-passe-oublie",
    });
  });

  it("carries the query over (returnTo, Pro intent, email)", () => {
    const t = authSwitchTargets("/fr/connexion", "?returnTo=%2Fdashboard%2Fbilling&plan=pro");
    expect(t).toEqual({
      en: "/sign-in?returnTo=%2Fdashboard%2Fbilling&plan=pro",
      fr: "/fr/connexion?returnTo=%2Fdashboard%2Fbilling&plan=pro",
    });
    const p = new URLSearchParams({ email: "a@b.fr" });
    expect(authSwitchTargets("/sign-up", p)?.fr).toBe("/fr/inscription?email=a%40b.fr");
  });

  it("ignores a trailing slash and an empty query", () => {
    expect(authSwitchTargets("/sign-in/", "")).toEqual({ en: "/sign-in", fr: "/fr/connexion" });
    expect(authSwitchTargets("/sign-in", "?")).toEqual({ en: "/sign-in", fr: "/fr/connexion" });
  });

  it("offers no switcher on the reset-password screens", () => {
    expect(authSwitchTargets("/reset-password")).toBeNull();
    expect(authSwitchTargets("/fr/nouveau-mot-de-passe")).toBeNull();
  });

  it("offers no switcher outside the auth screens", () => {
    expect(authSwitchTargets("/plans")).toBeNull();
    expect(authSwitchTargets("/dashboard")).toBeNull();
  });
});
