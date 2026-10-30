import { PRICING } from "./pricing";

// What an account running on the promotional sign-up credit alone may do
// (contract W4). "Promo-only" = the wallet has never been funded with real
// money (no paid top-up, no converted subscription).
//
// The €10 credit is free compute, so the MCPs that turn a box into a general
// purpose computer (a shell, a code interpreter, a scripted browser) wait for
// a first top-up. Everything else in the catalogue stays installable.
//
// Pure module (imports only the pure price list): safe in API routes and in
// client components alike.

/**
 * Catalogue slugs (lib/servers/seed-catalog.ts) withheld from promo-only
 * accounts:
 *   - shell        runs arbitrary shell commands and scripts inside the box
 *   - e2b          "E2B Code Interpreter": model-driven code execution
 *   - browserbase  drives a headless cloud browser
 * Keep in sync with the catalogue; eligibility.test.ts checks each slug exists.
 */
export const PROMO_EXCLUDED_MCP_SLUGS: readonly string[] = ["shell", "e2b", "browserbase"];

const EXCLUDED_SET: ReadonlySet<string> = new Set(PROMO_EXCLUDED_MCP_SLUGS);

// Community (user-published) MCPs are not curated, so they are screened by
// their slug words and start command too: a slug or command naming one of these
// is treated like the listed slugs. Whole words only ("browserbase" is listed
// explicitly; "chart" or "context7" never match).
const RISKY_WORDS = [
  "shell",
  "bash",
  "zsh",
  "powershell",
  "terminal",
  "exec",
  "executor",
  "command",
  "commands",
  "interpreter",
  "sandbox",
  "repl",
  "jupyter",
  "puppeteer",
  "playwright",
  "selenium",
  "browser",
  "chromium",
  "headless",
];
const RISKY_WORD_RE = new RegExp(`(?:^|[^a-z0-9])(?:${RISKY_WORDS.join("|")})(?:$|[^a-z0-9])`, "i");

/** The message the API returns (403) when a promo-only account installs an excluded MCP. */
export const PROMO_LOCKED_MCP_MESSAGE = `This MCP needs a funded wallet (top up €${PRICING.minTopupEur} to unlock)`;

/** Short badge shown on locked catalogue cards. */
export const PROMO_LOCKED_BADGE = "Needs a top-up";

/**
 * Whether an MCP may be installed while the account runs on promotional credit
 * only. `meta.startCmd` (the catalogue entry's launch command) is screened for
 * community MCPs whose slug hides what they run.
 */
export function canUseMcpOnPromo(
  slug: string,
  meta?: { startCmd?: string | null; isOfficial?: boolean | null }
): boolean {
  const s = slug.trim().toLowerCase();
  if (EXCLUDED_SET.has(s)) return false;
  // Official entries are curated: only the explicit list applies to them.
  if (meta?.isOfficial) return true;
  if (RISKY_WORD_RE.test(s)) return false;
  if (meta?.startCmd && RISKY_WORD_RE.test(meta.startCmd)) return false;
  return true;
}

/**
 * Whether the account runs on promotional credit only (never funded).
 * `subscriptionStatus` is users.subscription_status: a legacy subscription
 * still being paid ("active" / "past_due", not yet converted by the owner's
 * script) counts as funded. users.plan is deliberately NOT consulted: billing
 * no longer downgrades plans, so a trial that never paid can keep plan='pro'.
 */
export function isPromoOnly(
  wallet: { funded: boolean },
  subscriptionStatus?: string | null
): boolean {
  if (wallet.funded) return false;
  return subscriptionStatus !== "active" && subscriptionStatus !== "past_due";
}
