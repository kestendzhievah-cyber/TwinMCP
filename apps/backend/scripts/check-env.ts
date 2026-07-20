// pnpm check-env — validate that .env.local has the vars each feature needs.
// Run from apps/backend with: tsx scripts/check-env.ts
//
// Reads .env.local automatically. Reports missing vars grouped by feature
// and lists which endpoints break for each missing group.

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.resolve(__dirname, "..", ".env.local");

function loadEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, "utf-8");
  const env: Record<string, string> = {};
  let key: string | null = null;
  let buf: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (key) {
      buf.push(line);
      if (line.endsWith('"')) {
        env[key] = buf.join("\n").replace(/^"|"$/g, "");
        key = null;
        buf = [];
      }
      continue;
    }
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (v.startsWith('"') && !v.endsWith('"')) {
      key = k;
      buf = [v];
    } else {
      env[k] = v.replace(/^"|"$/g, "");
    }
  }
  return env;
}

interface Group {
  name: string;
  required: string[];
  optional?: string[];
  breaks: string[];
  required_for_boot?: boolean;
}

const GROUPS: Group[] = [
  {
    name: "Database (Supabase Postgres)",
    required: ["DATABASE_URL", "DATABASE_URL_UNPOOLED"],
    breaks: ["everything — server won't boot, all DB queries"],
    required_for_boot: true,
  },
  {
    name: "Auth (Supabase client)",
    required: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    optional: ["SUPABASE_SERVICE_ROLE_KEY"],
    breaks: [
      "sign-in, sign-up, dashboard, all session-gated endpoints",
      "SUPABASE_SERVICE_ROLE_KEY (optional): GDPR account deletion can't erase the Supabase auth identity without it — required for full right-to-erasure",
    ],
    required_for_boot: true,
  },
  {
    // OAuth is opt-in (OAUTH_ENABLED=1). Default MCP auth is the ctx7sk_ API key,
    // so these are not required for launch.
    name: "OAuth 2.1 (optional — only if OAUTH_ENABLED=1)",
    required: [],
    optional: ["OAUTH_ENABLED", "OAUTH_JWT_PRIVATE_KEY", "OAUTH_JWT_PUBLIC_KEY", "OAUTH_ISSUER"],
    breaks: ["OAuth MCP transport (disabled by default — clients use the ctx7sk_ Bearer key)"],
  },
  {
    name: "Security",
    required: ["CLIENT_IP_ENCRYPTION_KEY"],
    breaks: ["IP encryption (GDPR audit trail)"],
  },
  {
    // Names MUST match lib/stripe.ts (getPriceId). Pro monthly is the minimum
    // for a working checkout; the rest are opt-in cadences/plans.
    name: "Billing (Stripe)",
    required: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRO_MONTHLY_PRICE_ID"],
    optional: [
      "STRIPE_PRO_YEARLY_PRICE_ID",
      "STRIPE_TEAM_MONTHLY_PRICE_ID",
      "STRIPE_TEAM_YEARLY_PRICE_ID",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    ],
    breaks: ["/api/v2/billing/checkout, /api/v2/billing/portal, /api/webhooks/stripe"],
  },
  {
    name: "AI (OpenAI embeddings)",
    required: ["OPENAI_API_KEY"],
    optional: ["OPENAI_EMBEDDING_MODEL"],
    breaks: ["/api/v2/context (semantic search), ingestion embeddings"],
  },
  {
    name: "Rate-limiting + cache (Upstash Redis REST)",
    required: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    breaks: ["rate-limiting on every API route, cache layer"],
  },
  {
    name: "Job queue (Upstash QStash) — optional",
    required: [],
    optional: [
      "QSTASH_TOKEN",
      "QSTASH_CURRENT_SIGNING_KEY",
      "QSTASH_NEXT_SIGNING_KEY",
      "APP_URL",
      "RECONCILE_HEALTH_INTERVAL_MS",
    ],
    breaks: [
      "durable provisioning on serverless (silent fallback to inline fire-and-forget)",
      "RECONCILE_HEALTH_INTERVAL_MS (optional): in-process box-health reconciliation loop; unset = rely on a QStash reconcile-health cron",
    ],
  },
  {
    name: "Public URLs / CORS — optional",
    required: [],
    optional: ["NEXT_PUBLIC_SITE_URL", "CORS_ORIGIN"],
    breaks: ["absolute links + CORS origin lock (next.config falls back to '*')"],
  },
  {
    name: "MCP runtime (Upstash Box)",
    required: ["UPSTASH_BOX_API_KEY"],
    breaks: [
      "per-user MCP runtimes (core feature) — provisioning refuses to run in stub mode in production",
    ],
  },
  {
    name: "Config encryption",
    required: ["CONFIG_ENCRYPTION_KEY"],
    breaks: ["MCP install with secrets, reconfigure (AES-256-GCM key required)"],
  },
  {
    name: "Ingestion worker",
    required: ["GITHUB_TOKEN", "REDIS_URL"],
    optional: ["INGEST_CONCURRENCY"],
    breaks: ["apps/ingest worker (BullMQ, GitHub crawl)"],
  },
  {
    name: "Object storage (Cloudflare R2) — optional",
    required: [],
    optional: [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET",
      "R2_PUBLIC_URL",
    ],
    breaks: ["raw doc storage (silent fallback)"],
  },
  {
    name: "Email (Resend) — optional",
    required: [],
    optional: ["RESEND_API_KEY", "EMAIL_FROM", "SALES_EMAIL"],
    breaks: [
      "upgrade-confirmation emails (silent fallback)",
      "SALES_EMAIL: where Team/Enterprise contact-form inquiries are delivered (set to your inbox); needs RESEND_API_KEY to actually send",
    ],
  },
  {
    name: "Observability — optional",
    required: [],
    optional: ["SENTRY_DSN", "AXIOM_TOKEN", "AXIOM_DATASET"],
    breaks: ["error tracking, structured logging (silent fallback)"],
  },
  {
    name: "Funnel analytics (PostHog Cloud EU) — optional",
    required: [],
    optional: ["NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST"],
    breaks: ["funnel events (landing → signup → first server) silent no-op"],
  },
  {
    name: "SEO verification (Search Console / Bing / Yandex) — optional",
    required: [],
    optional: [
      "NEXT_PUBLIC_GSC_VERIFICATION",
      "NEXT_PUBLIC_BING_VERIFICATION",
      "NEXT_PUBLIC_YANDEX_VERIFICATION",
    ],
    breaks: ["search-engine ownership verification (verification meta tags silently omitted)"],
  },
  {
    name: "IndexNow (instant indexing for Bing/Yandex) — optional",
    required: [],
    optional: ["INDEXNOW_KEY"],
    breaks: ["/indexnow.txt returns 404, submitUrls() no-ops with a warning"],
  },
];

const env = { ...loadEnvFile(ENV_FILE), ...process.env };

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

let bootOk = true;
let bootedFeatures = 0;
let totalFeatures = 0;
const blockers: string[] = [];

console.log(`\n  ${DIM}Reading${RESET} ${ENV_FILE}\n`);

for (const g of GROUPS) {
  const missing = g.required.filter((k) => !env[k]);
  const optMissing = (g.optional ?? []).filter((k) => !env[k]);
  const optTotal = (g.optional ?? []).length;

  totalFeatures++;
  if (missing.length === 0) {
    bootedFeatures++;
    const optNote =
      optTotal > 0 ? ` ${DIM}(opt: ${optTotal - optMissing.length}/${optTotal})${RESET}` : "";
    console.log(`  ${GREEN}OK${RESET}    ${g.name}${optNote}`);
  } else {
    if (g.required_for_boot) bootOk = false;
    const tag = g.required_for_boot ? `${RED}FAIL${RESET}` : `${YELLOW}TODO${RESET}`;
    console.log(`  ${tag}  ${g.name}`);
    console.log(`        ${DIM}missing:${RESET} ${missing.join(", ")}`);
    console.log(`        ${DIM}breaks:${RESET}  ${g.breaks.join(", ")}`);
    blockers.push(g.name);
  }
}

console.log();
if (!bootOk) {
  console.log(`  ${RED}Server won't boot.${RESET} Critical vars missing — see FAIL above.`);
  process.exit(1);
}

console.log(
  `  ${GREEN}Server can boot${RESET} (${bootedFeatures}/${totalFeatures} feature groups configured)`
);
if (blockers.length > 0) {
  console.log(`  ${YELLOW}${blockers.length} feature(s) degraded:${RESET} ${blockers.join(", ")}`);
}
console.log();
