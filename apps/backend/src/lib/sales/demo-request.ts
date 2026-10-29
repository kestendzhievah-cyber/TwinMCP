// Guided-setup ("demo") requests: the form on /demo and /fr/demo posts to
// /api/v2/contact-sales. Pure and client-safe (zod only), so the form, the
// route, the emails and the tests share one schema and one set of labels.

import { z } from "zod";
import type { Locale } from "@/lib/i18n/locales";
import type { IdeKey } from "@/lib/mcp/client-config";
import { getBundle } from "@/lib/mcp-bundles";

export const DEMO_PATHS = { en: "/demo", fr: "/fr/demo" } as const satisfies Record<Locale, string>;

/** Why the visitor writes: the guided setup, a DPA request, or a security report/question. */
export const DEMO_TOPICS = ["setup", "dpa", "security"] as const;
export type DemoTopic = (typeof DEMO_TOPICS)[number];

export const TEAM_SIZES = ["1", "2-10", "11-50", "51-200", "200+"] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

/** The AI clients the connect UI generates a config for (lib/mcp/client-config.ts), plus "other". */
export const DEMO_CLIENTS = [
  "cursor",
  "claude-desktop",
  "claude-code",
  "vscode",
  "windsurf",
  "cline",
  "zed",
  "other",
] as const satisfies readonly IdeKey[];
export type DemoClient = (typeof DEMO_CLIENTS)[number];

/** Name of the hidden honeypot field: humans never see it, naive bots fill it. */
export const HONEYPOT_FIELD = "website";

export const DEMO_GOAL_MAX = 2000;

/**
 * Company and team size only matter for a guided setup: a security researcher
 * or a DPA requester is not asked for them.
 */
export function demoTopicNeedsCompany(topic: DemoTopic): boolean {
  return topic === "setup";
}

export const demoRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().email().max(200),
    company: z.string().trim().max(200).default(""),
    teamSize: z.enum(TEAM_SIZES).optional(),
    clients: z.array(z.enum(DEMO_CLIENTS)).max(DEMO_CLIENTS.length).default([]),
    goal: z.string().trim().min(1).max(DEMO_GOAL_MAX),
    // GDPR: the request is processed only with the explicit checkbox ticked.
    consent: z.literal(true),
    topic: z.enum(DEMO_TOPICS).default("setup"),
    locale: z.enum(["en", "fr"]).default("en"),
    // MCP pack the visitor came from (/solutions/<pack> → /demo?bundle=<id>).
    // Context only: an unknown id is dropped, never an error.
    // The length cap lives inside the transform so an over-long value is
    // dropped too, instead of failing the whole request with a 400.
    bundle: z
      .string()
      .optional()
      .transform((v) => {
        const t = v?.trim();
        return t && t.length <= 40 && getBundle(t) ? t : undefined;
      }),
  })
  .superRefine((d, ctx) => {
    if (!demoTopicNeedsCompany(d.topic)) return;
    if (!d.company) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["company"], message: "Required" });
    }
    if (!d.teamSize) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["teamSize"], message: "Required" });
    }
  });
export type DemoRequest = z.infer<typeof demoRequestSchema>;

/** The top-level fields a failed parse points at (the form marks them aria-invalid). */
export function demoInvalidFields(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }>
): string[] {
  return [...new Set(issues.map((i) => String(i.path[0] ?? "")).filter(Boolean))];
}

/** Company as shown in the CRM and the sales email ("—" when not asked). */
export function demoCompanyLabel(d: Pick<DemoRequest, "company">): string {
  return d.company || "—";
}

// Redis-independent abuse limits for this public form (the Redis limits fail
// open, and the X-Forwarded-For chain is client-controlled):
/** One acknowledgement (and one CRM row) per address in this window. */
export const DEMO_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Most new requests accepted per rolling hour, all addresses together. */
export const DEMO_HOURLY_CAP = 30;
/** Longest CRM note a repeated request may grow to. */
export const DEMO_NOTES_MAX = 8000;

/** Same address already wrote within the dedupe window? */
export function isRecentDemoRequest(
  lastCreatedAt: Date | null | undefined,
  now: number = Date.now()
): boolean {
  return !!lastCreatedAt && now - lastCreatedAt.getTime() < DEMO_DEDUPE_WINDOW_MS;
}

/** Append a repeated request to the existing CRM note, bounded. */
export function appendDemoNote(existing: string, addition: string, max = DEMO_NOTES_MAX): string {
  if (existing.length >= max) return existing;
  return `${existing}

---

${addition}`.slice(0, max);
}

/** `?topic=` on /demo → a known topic ("setup" for anything else). */
export function parseDemoTopic(value: string | string[] | undefined): DemoTopic {
  const v = Array.isArray(value) ? value[0] : value;
  return (DEMO_TOPICS as readonly string[]).includes(v ?? "") ? (v as DemoTopic) : "setup";
}

/** `?bundle=` on /demo (links from the solution pages) → a known MCP_BUNDLES id, or undefined. */
export function parseDemoBundle(value: string | string[] | undefined): string | undefined {
  const v = (Array.isArray(value) ? value[0] : value)?.trim();
  return v && getBundle(v) ? v : undefined;
}

/** True when the honeypot field carries anything: answer 200, store nothing. */
export function isHoneypotFilled(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const v = (body as Record<string, unknown>)[HONEYPOT_FIELD];
  return typeof v === "string" ? v.trim().length > 0 : v != null && v !== false;
}

const CLIENT_LABELS: Record<DemoClient, string> = {
  cursor: "Cursor",
  "claude-desktop": "Claude Desktop",
  "claude-code": "Claude Code",
  vscode: "VS Code",
  windsurf: "Windsurf",
  cline: "Cline",
  zed: "Zed",
  other: "Other",
};

export function demoClientLabel(client: DemoClient, locale: Locale = "en"): string {
  if (client === "other" && locale === "fr") return "Autre";
  return CLIENT_LABELS[client];
}

const TOPIC_LABELS: Record<Locale, Record<DemoTopic, string>> = {
  en: { setup: "Guided setup", dpa: "Data Processing Agreement", security: "Security" },
  fr: {
    setup: "Installation accompagnée",
    dpa: "Accord de traitement des données (DPA)",
    security: "Sécurité",
  },
};

export function demoTopicLabel(topic: DemoTopic, locale: Locale = "en"): string {
  return TOPIC_LABELS[locale][topic];
}

/** Every `source` value this form writes (to find its own rows). */
export const DEMO_SOURCES = [
  "Site web (installation accompagnée)",
  "Site web (DPA)",
  "Site web (sécurité)",
] as const;

/** `source` column of the prospection CRM (the admin CRM is in French). */
export function demoRequestSource(topic: DemoTopic): string {
  if (topic === "dpa") return "Site web (DPA)";
  if (topic === "security") return "Site web (sécurité)";
  return "Site web (installation accompagnée)";
}

/** The CRM note: one facts line, then the visitor's own words. */
export function demoRequestNotes(d: DemoRequest): string {
  const clients = d.clients.length ? d.clients.map((c) => demoClientLabel(c)).join(", ") : "—";
  const facts = [
    demoTopicLabel(d.topic),
    `Team: ${d.teamSize ?? "—"}`,
    `Clients: ${clients}`,
    ...(d.bundle ? [`Pack: ${getBundle(d.bundle)?.label ?? d.bundle}`] : []),
    `Lang: ${d.locale}`,
  ].join(" · ");
  return `${facts}\n\n${d.goal}`;
}

/** Strips line breaks so user input can never add an email header line. */
export function headerSafe(s: string, max = 120): string {
  return s
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);
}
