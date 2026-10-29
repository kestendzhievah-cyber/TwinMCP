import { describe, expect, it } from "vitest";
import {
  DEMO_CLIENTS,
  DEMO_PATHS,
  demoClientLabel,
  demoRequestNotes,
  demoRequestSchema,
  demoRequestSource,
  demoTopicLabel,
  headerSafe,
  isHoneypotFilled,
  parseDemoTopic,
  parseDemoBundle,
  appendDemoNote,
  demoCompanyLabel,
  demoInvalidFields,
  demoTopicNeedsCompany,
  isRecentDemoRequest,
  DEMO_DEDUPE_WINDOW_MS,
  DEMO_NOTES_MAX,
  DEMO_SOURCES,
} from "../lib/sales/demo-request";
import { pickClientIp } from "../lib/net/client-ip";
import { GUEST_ONLY_PREFIXES, startsWithAny } from "../utils/supabase/middleware";
import { IDE_LABELS } from "../lib/mcp/client-config";
import { hasFrenchVersion, localizedPath } from "../lib/i18n/locales";
import { DEMO_CONVERSION, demoTransactionId } from "../lib/analytics/google-ads";

const valid = {
  name: "Jane Doe",
  email: "  Jane@Example.com ",
  company: "Acme",
  teamSize: "2-10",
  clients: ["cursor", "claude-code"],
  goal: "Let Claude read our Notion.",
  consent: true,
};

describe("demoRequestSchema", () => {
  it("accepts a complete request and normalises it", () => {
    const r = demoRequestSchema.parse(valid);
    expect(r.email).toBe("jane@example.com");
    expect(r.topic).toBe("setup");
    expect(r.locale).toBe("en");
    expect(r.clients).toEqual(["cursor", "claude-code"]);
  });

  it("requires the consent box to be ticked", () => {
    expect(demoRequestSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    const noConsent: Partial<typeof valid> = { ...valid };
    delete noConsent.consent;
    expect(demoRequestSchema.safeParse(noConsent).success).toBe(false);
  });

  it("rejects unknown team sizes, clients, topics and empty fields", () => {
    expect(demoRequestSchema.safeParse({ ...valid, teamSize: "1000" }).success).toBe(false);
    expect(demoRequestSchema.safeParse({ ...valid, clients: ["chatgpt"] }).success).toBe(false);
    expect(demoRequestSchema.safeParse({ ...valid, topic: "sales" }).success).toBe(false);
    expect(demoRequestSchema.safeParse({ ...valid, goal: "   " }).success).toBe(false);
    expect(demoRequestSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });

  it("defaults clients to an empty list", () => {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest.clients;
    expect(demoRequestSchema.parse(rest).clients).toEqual([]);
  });
});

describe("DEMO_CLIENTS", () => {
  it("only lists clients the connect UI knows", () => {
    for (const c of DEMO_CLIENTS) expect(IDE_LABELS).toHaveProperty(c);
  });

  it("labels 'other' per locale", () => {
    expect(demoClientLabel("other", "fr")).toBe("Autre");
    expect(demoClientLabel("other")).toBe("Other");
    expect(demoClientLabel("vscode", "fr")).toBe("VS Code");
  });
});

describe("parseDemoTopic", () => {
  it("keeps known topics and falls back to setup", () => {
    expect(parseDemoTopic("dpa")).toBe("dpa");
    expect(parseDemoTopic(["security", "dpa"])).toBe("security");
    expect(parseDemoTopic("anything")).toBe("setup");
    expect(parseDemoTopic(undefined)).toBe("setup");
  });
});

describe("isHoneypotFilled", () => {
  it("flags any non-empty value in the honeypot field", () => {
    expect(isHoneypotFilled({ website: "http://spam.example" })).toBe(true);
    expect(isHoneypotFilled({ website: 1 })).toBe(true);
  });

  it("lets humans through", () => {
    expect(isHoneypotFilled({ website: "" })).toBe(false);
    expect(isHoneypotFilled({ website: "   " })).toBe(false);
    expect(isHoneypotFilled({})).toBe(false);
    expect(isHoneypotFilled(null)).toBe(false);
    expect(isHoneypotFilled("x")).toBe(false);
  });
});

describe("CRM helpers", () => {
  it("writes a facts line then the visitor's words", () => {
    const r = demoRequestSchema.parse({ ...valid, locale: "fr", topic: "dpa" });
    expect(demoRequestNotes(r)).toBe(
      "Data Processing Agreement · Team: 2-10 · Clients: Cursor, Claude Code · Lang: fr\n\nLet Claude read our Notion."
    );
    expect(demoRequestNotes({ ...r, clients: [] })).toContain("Clients: —");
  });

  it("maps topics to CRM sources", () => {
    expect(demoRequestSource("setup")).toBe("Site web (installation accompagnée)");
    expect(demoRequestSource("dpa")).toBe("Site web (DPA)");
    expect(demoRequestSource("security")).toBe("Site web (sécurité)");
  });

  it("labels topics in both languages", () => {
    expect(demoTopicLabel("setup")).toBe("Guided setup");
    expect(demoTopicLabel("setup", "fr")).toBe("Installation accompagnée");
  });
});

describe("headerSafe", () => {
  it("removes line breaks so input cannot add a header", () => {
    expect(headerSafe("Acme\r\nBcc: x@y.z")).toBe("Acme Bcc: x@y.z");
    expect(headerSafe("a".repeat(300), 10)).toHaveLength(10);
  });
});

describe("i18n registry for the trust pages", () => {
  it("/demo has a prefix twin", () => {
    expect(DEMO_PATHS).toEqual({ en: "/demo", fr: "/fr/demo" });
    expect(hasFrenchVersion("/demo")).toBe(true);
    expect(localizedPath("/demo", "fr")).toBe("/fr/demo");
    expect(localizedPath("/fr/demo", "en")).toBe("/demo");
  });

  it("/security has a translated twin", () => {
    expect(hasFrenchVersion("/security")).toBe(false);
    expect(localizedPath("/security", "fr")).toBe("/fr/securite");
    expect(localizedPath("/fr/securite", "en")).toBe("/security");
  });
});

describe("demo conversion", () => {
  it("is a no-op until NEXT_PUBLIC_GOOGLE_ADS_DEMO_SEND_TO is set", () => {
    expect(DEMO_CONVERSION).toBe(process.env.NEXT_PUBLIC_GOOGLE_ADS_DEMO_SEND_TO || "");
  });

  it("uses a unique, prefixed transaction id", () => {
    const a = demoTransactionId();
    expect(a).toMatch(/^demo-/);
    expect(demoTransactionId()).not.toBe(a);
  });
});

describe("i18n registry for /changelog and guest-only FR auth", () => {
  it("/changelog has a prefix twin", () => {
    expect(hasFrenchVersion("/changelog")).toBe(true);
    expect(localizedPath("/changelog", "fr")).toBe("/fr/changelog");
  });

  it("/fr/connexion is guest-only, like /sign-in", () => {
    expect(startsWithAny("/fr/connexion", GUEST_ONLY_PREFIXES)).toBe(true);
    expect(startsWithAny("/sign-in", GUEST_ONLY_PREFIXES)).toBe(true);
    expect(startsWithAny("/fr/connexion-x", GUEST_ONLY_PREFIXES)).toBe(false);
  });
});

describe("topic-dependent required fields", () => {
  const bare: Record<string, unknown> = { ...valid };
  delete bare.company;
  delete bare.teamSize;

  it("a guided setup needs company and team size", () => {
    const r = demoRequestSchema.safeParse({ ...bare, topic: "setup" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(demoInvalidFields(r.error.issues).sort()).toEqual(["company", "teamSize"]);
    }
    expect(demoTopicNeedsCompany("setup")).toBe(true);
  });

  it("a DPA or security request does not", () => {
    for (const topic of ["dpa", "security"] as const) {
      const r = demoRequestSchema.parse({ ...bare, topic });
      expect(r.company).toBe("");
      expect(r.teamSize).toBeUndefined();
      expect(demoCompanyLabel(r)).toBe("—");
      expect(demoRequestNotes(r)).toContain("Team: —");
    }
  });
});

describe("Redis-independent abuse guards", () => {
  it("dedupes the same address for 24 h", () => {
    const now = Date.UTC(2026, 9, 28, 12);
    expect(isRecentDemoRequest(new Date(now - 60_000), now)).toBe(true);
    expect(isRecentDemoRequest(new Date(now - DEMO_DEDUPE_WINDOW_MS - 1), now)).toBe(false);
    expect(isRecentDemoRequest(null, now)).toBe(false);
  });

  it("appends a repeated request to the note, bounded", () => {
    expect(appendDemoNote("a", "b")).toBe("a\n\n---\n\nb");
    expect(appendDemoNote("a".repeat(10), "b".repeat(10), 12)).toHaveLength(12);
    const full = "x".repeat(DEMO_NOTES_MAX);
    expect(appendDemoNote(full, "more")).toBe(full);
  });

  it("every CRM source the form writes is in DEMO_SOURCES", () => {
    for (const topic of ["setup", "dpa", "security"] as const) {
      expect(DEMO_SOURCES).toContain(demoRequestSource(topic));
    }
  });
});

describe("pickClientIp — never the client-controlled left-most hop", () => {
  it("prefers X-Real-Ip set by the proxy", () => {
    expect(pickClientIp("203.0.113.9", "1.1.1.1, 203.0.113.9")).toBe("203.0.113.9");
  });

  it("falls back to the right-most X-Forwarded-For entry", () => {
    expect(pickClientIp(null, "6.6.6.6, 198.51.100.7")).toBe("198.51.100.7");
    expect(pickClientIp("", " 198.51.100.7 ")).toBe("198.51.100.7");
    expect(pickClientIp(null, null)).toBeNull();
  });
});

describe("?bundle= from the solution pages", () => {
  it("accepts only a known MCP_BUNDLES id", () => {
    expect(parseDemoBundle("dev")).toBe("dev");
    expect(parseDemoBundle([" finance ", "dev"])).toBe("finance");
    expect(parseDemoBundle("nope")).toBeUndefined();
    expect(parseDemoBundle("")).toBeUndefined();
    expect(parseDemoBundle(undefined)).toBeUndefined();
  });

  it("keeps a known pack in the request and the CRM note, drops an unknown one", () => {
    const r = demoRequestSchema.parse({ ...valid, bundle: "dev" });
    expect(r.bundle).toBe("dev");
    expect(demoRequestNotes(r)).toContain("Pack: Développeur");
    const unknown = demoRequestSchema.safeParse({ ...valid, bundle: "nope" });
    expect(unknown.success).toBe(true);
    expect(unknown.success && unknown.data.bundle).toBeUndefined();
    // An over-long value is dropped too, never a 400 for the whole request.
    const long = demoRequestSchema.safeParse({ ...valid, bundle: "x".repeat(41) });
    expect(long.success).toBe(true);
    expect(long.success && long.data.bundle).toBeUndefined();
    expect(demoRequestNotes(demoRequestSchema.parse(valid))).not.toContain("Pack:");
  });
});
