import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION_KEYS,
  ATTRIBUTION_MAX_LENGTH,
  attributionKeys,
  hasAttributionKeys,
  readAttribution,
  referrerHost,
  withAttribution,
} from "@/lib/analytics/attribution";
import { pageServedProperties } from "@/lib/analytics/server";

describe("readAttribution", () => {
  it("parses utm_*, gclid and ref", () => {
    const a = readAttribution(
      "?utm_source=google&utm_medium=cpc&utm_campaign=mcp-fr&utm_term=mcp+hosting&utm_content=ad1&gclid=Cj0abc&ref=partner"
    );
    expect(a).toMatchObject({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "mcp-fr",
      utm_term: "mcp hosting",
      utm_content: "ad1",
      gclid: "Cj0abc",
      ref: "partner",
    });
    expect(typeof a?.first_seen_at).toBe("string");
  });

  it("accepts a query without '?', a URLSearchParams and a full URL", () => {
    expect(readAttribution("gclid=x")?.gclid).toBe("x");
    expect(readAttribution(new URLSearchParams({ utm_source: "bing" }))?.utm_source).toBe("bing");
    expect(readAttribution("https://twinmcp.fr/fr?utm_campaign=c#top")?.utm_campaign).toBe("c");
  });

  it("ignores unknown keys and returns null without any attribution key", () => {
    const a = readAttribution("?utm_source=google&foo=bar&fbclid=zz");
    expect(a).not.toBeNull();
    expect(a).not.toHaveProperty("foo");
    expect(a).not.toHaveProperty("fbclid");
    expect(readAttribution("?foo=bar&plan=pro")).toBeNull();
    expect(readAttribution("")).toBeNull();
    expect(readAttribution("?utm_source=%20%20")).toBeNull();
  });

  it("truncates values to 200 characters", () => {
    const long = "x".repeat(500);
    const a = readAttribution(`?gclid=${long}&utm_source=${long}`);
    expect(ATTRIBUTION_MAX_LENGTH).toBe(200);
    expect(a?.gclid).toHaveLength(200);
    expect(a?.utm_source).toHaveLength(200);
  });

  it("adds the landing context from `extra`", () => {
    const a = readAttribution("?utm_source=google", {
      path: "/fr",
      locale: "fr",
      referrer: "https://www.google.fr/search?q=mcp",
    });
    expect(a).toMatchObject({ landing_path: "/fr", locale: "fr", referrer_host: "www.google.fr" });
  });
});

describe("withAttribution", () => {
  const attribution = readAttribution("?utm_source=google&utm_campaign=mcp&gclid=abc", {
    path: "/",
    locale: "en",
  });

  it("appends only the attribution keys", () => {
    const href = withAttribution("/sign-up", attribution);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(href.startsWith("/sign-up?")).toBe(true);
    expect(params.get("utm_source")).toBe("google");
    expect(params.get("utm_campaign")).toBe("mcp");
    expect(params.get("gclid")).toBe("abc");
    expect(params.has("landing_path")).toBe(false);
    expect(params.has("first_seen_at")).toBe(false);
  });

  it("keeps existing params and the fragment", () => {
    const href = withAttribution("/sign-up?plan=pro#form", attribution);
    expect(href.endsWith("#form")).toBe(true);
    const params = new URLSearchParams(href.split("?")[1].split("#")[0]);
    expect(params.get("plan")).toBe("pro");
    expect(params.get("gclid")).toBe("abc");
  });

  it("never duplicates nor overwrites a key already on the link", () => {
    const href = withAttribution("/plans?utm_source=newsletter", attribution);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.getAll("utm_source")).toEqual(["newsletter"]);
    // Idempotent: a second pass adds nothing.
    expect(withAttribution(href, attribution)).toBe(href);
  });

  it("works on absolute URLs", () => {
    const href = withAttribution("https://twinmcp.fr/fr/inscription", attribution);
    expect(new URL(href).searchParams.get("gclid")).toBe("abc");
  });

  it("returns the href unchanged when there is nothing to add", () => {
    expect(withAttribution("/sign-up", null)).toBe("/sign-up");
    expect(withAttribution("/sign-up", {})).toBe("/sign-up");
    expect(withAttribution("/sign-up", { landing_path: "/" })).toBe("/sign-up");
    expect(withAttribution("#features", attribution)).toBe("#features");
    expect(withAttribution("mailto:hello@twinmcp.fr", attribution)).toBe("mailto:hello@twinmcp.fr");
  });
});

describe("helpers", () => {
  it("lists the documented keys", () => {
    expect([...ATTRIBUTION_KEYS]).toEqual([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "ref",
    ]);
  });

  it("hasAttributionKeys ignores the landing context", () => {
    expect(hasAttributionKeys(null)).toBe(false);
    expect(hasAttributionKeys({ referrer_host: "x.com" })).toBe(false);
    expect(hasAttributionKeys({ ref: "p" })).toBe(true);
  });

  it("attributionKeys keeps only campaign keys", () => {
    expect(attributionKeys({ gclid: "g", landing_path: "/", locale: "fr" })).toEqual({
      gclid: "g",
    });
  });

  it("referrerHost parses or returns undefined", () => {
    expect(referrerHost("https://chatgpt.com/c/123")).toBe("chatgpt.com");
    expect(referrerHost("")).toBeUndefined();
    expect(referrerHost("not a url")).toBeUndefined();
  });
});

describe("pageServedProperties (server-side denominator)", () => {
  const browser =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

  it("keeps utm_* and only the presence of gclid, never the id", () => {
    const props = pageServedProperties({
      path: "/fr",
      locale: "fr",
      searchParams: { utm_source: "google", utm_campaign: ["mcp", "dup"], gclid: "Cj0secret" },
      headers: new Headers({
        "user-agent": browser,
        host: "twinmcp.fr",
        referer: "https://www.google.fr/",
      }),
    });
    expect(props).toMatchObject({
      path: "/fr",
      locale: "fr",
      utm_source: "google",
      utm_campaign: "mcp",
      gclid_present: true,
      referrer_host: "www.google.fr",
      navigation: "document",
    });
    expect(JSON.stringify(props)).not.toContain("Cj0secret");
  });

  it("drops the referrer when it is the site itself", () => {
    const props = pageServedProperties({
      path: "/",
      locale: "en",
      headers: new Headers({
        "user-agent": browser,
        "x-forwarded-host": "twinmcp.fr",
        referer: "https://twinmcp.fr/plans",
        rsc: "1",
      }),
    });
    expect(props?.referrer_host).toBeUndefined();
    expect(props?.gclid_present).toBe(false);
    expect(props?.navigation).toBe("client");
  });

  it("skips bots, prefetches and requests without a user agent", () => {
    const bot = new Headers({ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" });
    const prefetch = new Headers({ "user-agent": browser, "next-router-prefetch": "1" });
    expect(pageServedProperties({ path: "/", locale: "en", headers: bot })).toBeNull();
    expect(pageServedProperties({ path: "/", locale: "en", headers: prefetch })).toBeNull();
    expect(pageServedProperties({ path: "/", locale: "en", headers: new Headers() })).toBeNull();
  });
});
