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
    // OAuth is ON by default and needs no keys (random tokens stored hashed).
    // OAUTH_DISABLED=1 is the kill switch; OAUTH_ISSUER is optional.
    name: "OAuth 2.1 for MCP connectors — optional",
    required: [],
    optional: ["OAUTH_DISABLED", "OAUTH_ISSUER"],
    breaks: [
      "OAUTH_DISABLED=1: claude.ai / ChatGPT custom connectors can't sign in (ctx7sk_ keys keep working)",
    ],
  },
  {
    name: "Scheduled jobs + activity log — optional",
    required: [],
    optional: [
      "CRON_SECRET",
      "ACTIVITY_LOG_DISABLED",
      "ACTIVITY_FLUSH_MS",
      "ACTIVITY_FLUSH_BATCH",
      "WEBHOOKS_ALLOW_PRIVATE",
      "WEBHOOKS_DENY_CIDRS",
      "WEBHOOKS_DENY_SELF",
    ],
    breaks: [
      "CRON_SECRET: /api/cron/{digest,churn,nudges,purge,meter-boxes,wallet-enforce,wallet-expiry,wallet-reminders} only callable from an admin session — no retention purge, no compute billing, no promo expiry from a scheduler",
    ],
  },
  {
    name: "Security",
    required: ["CLIENT_IP_ENCRYPTION_KEY"],
    breaks: ["IP encryption (GDPR audit trail)"],
  },
  {
    // Prepaid wallet (2026-10-29): top-ups use inline price_data, so no price
    // id is needed. STRIPE_PRO_* / STRIPE_TEAM_* are LEGACY (only the old
    // subscription webhooks and scripts/migrate-pro-to-wallet.ts read them).
    name: "Billing (Stripe)",
    required: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    optional: [
      "STRIPE_TAX_ENABLED",
      "WALLET_TOPUP_TAX_BEHAVIOR",
      "STRIPE_TOPUP_TAX_CODE",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      "STRIPE_PRO_MONTHLY_PRICE_ID",
      "STRIPE_PRO_YEARLY_PRICE_ID",
      "STRIPE_TEAM_MONTHLY_PRICE_ID",
      "STRIPE_TEAM_YEARLY_PRICE_ID",
    ],
    breaks: [
      "/api/v2/wallet/topup, /api/v2/wallet/auto-recharge, /api/v2/billing/portal, /api/webhooks/stripe (paid top-ups never credited)",
    ],
  },
  {
    // Prepaid wallet knobs (lib/wallet/*). All have safe defaults except the
    // pepper, which falls back to CONFIG_ENCRYPTION_KEY (rotating that key
    // would then let every past email claim the sign-up credit again).
    name: "Prepaid wallet — optional",
    required: [],
    optional: [
      "SIGNUP_HASH_PEPPER",
      "WALLET_ENFORCE_ENABLED",
      "WALLET_COST_MULTIPLIER",
      "WALLET_USD_EUR",
      "WALLET_CALL_COST_EUR_PER_1000",
      "MCP_CALLS_PER_MINUTE",
      "RATE_LIMIT_PER_MINUTE",
      "SIGNUP_CREDIT_MAX_PER_IP_DAY",
      "SIGNUP_CREDIT_MAX_PER_SUBNET_DAY",
      "SIGNUP_CREDIT_MAX_PER_DAY",
    ],
    breaks: [
      "SIGNUP_HASH_PEPPER: sign-up credit dedupe keyed on CONFIG_ENCRYPTION_KEY instead",
      "WALLET_ENFORCE_ENABLED!=true: empty wallets still pause, but free-credit runtimes are never deleted (no deletion warnings)",
    ],
  },
  {
    // Comma-separated admin allowlist for /dashboard/admin analytics. Falls back
    // to a built-in founder email when unset, so this is optional but recommended.
    name: "Admin analytics — optional",
    required: [],
    optional: ["ADMIN_EMAILS"],
    breaks: ["/dashboard/admin locks to the built-in founder email until set"],
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
    optional: ["WARM_BOXES_ENABLED", "MAX_MCPS_SMALL", "MAX_MCPS_MEDIUM", "MAX_MCPS_LARGE"],
    breaks: [
      "per-user MCP runtimes (core feature) — provisioning refuses to run in stub mode in production",
      "WARM_BOXES_ENABLED=true (optional): Pro/Team servers run always-on (no cold start). Keep-alive boxes require a PAID Upstash plan — leave unset until that's active, or provisioning falls back to pause-when-idle.",
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
