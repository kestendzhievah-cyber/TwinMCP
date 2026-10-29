import { Resend } from "resend";
import type { Plan } from "@/db/schema/core";
import { PLAN_CAPABILITIES, PLAN_LABELS } from "@/lib/plan-features";
import { trialCta } from "@/lib/billing/upgrade-state";
import { PLANS, formatPrice } from "@/components/pricing/pricing-data";
import { cardEmail, esc, link, p, row, table } from "./email-layout";
import type { Locale } from "@/lib/i18n/locales";
import { EDITEUR } from "@/lib/legal/entity";
import { IDE_LABELS, MATRIX_CLIENTS } from "@/lib/mcp/client-config";
import {
  type DemoRequest,
  demoClientLabel,
  demoCompanyLabel,
  demoTopicLabel,
  headerSafe,
} from "@/lib/sales/demo-request";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  _resend = new Resend(key);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "TwinMCP <noreply@twinmcp.fr>";

/** Where Team/Enterprise sales inquiries are delivered. Set SALES_EMAIL to your
 *  inbox (e.g. your Gmail) in the environment. */
const SALES_TO = process.env.SALES_EMAIL ?? process.env.EMAIL_FROM ?? "hello@twinmcp.fr";

const DASHBOARD = "https://twinmcp.fr/dashboard";
const PLANS_URL = "https://twinmcp.fr/plans";
const BILLING = "https://twinmcp.fr/dashboard/billing";
const SETTINGS = "https://twinmcp.fr/dashboard/settings";
const ONBOARDING = "https://twinmcp.fr/onboarding";

/**
 * Closing line of every lifecycle ("nudge") email — why it arrived and where to
 * stop them (users.metadata.emailNudges, PATCH /api/v2/users/me/preferences).
 */
const PREFERENCES_NOTE = `You receive this because you have a TwinMCP account. Manage email preferences: ${link(`${SETTINGS}#email-notifications`, SETTINGS)}`;

// ---- Plan facts (never hand-typed: plan-features, rate-limit, pricing-data) ---

const PRO = PLAN_CAPABILITIES.pro;
const PRO_TIER = PLANS.find((t) => t.id === "pro");
/** "€14.99 a month, or €135 a year" — from the pricing table (mirrors Stripe). */
const PRO_PRICE_LINE = PRO_TIER
  ? `${formatPrice(PRO_TIER, "monthly")} a month, or €${Math.round(PRO_TIER.annualMonthlyUsd * 12)} a year`
  : "the price shown on the billing page";

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

/** "25 October 2026" (UTC, like the billing UI). */
function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "25 October 2026 at 00:00 UTC". */
function fmtDayTime(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${fmtDay(d)} at ${hh}:${mm} UTC`;
}

/**
 * The honest trial sentence. Only when the account is eligible (trialDays > 0):
 * the free month applies to a FIRST subscription only, card required, nothing
 * charged during the trial, cancel anytime.
 */
function trialLine(trialDays: number): string {
  if (trialDays <= 0) return "";
  return p(
    `<strong>Your first month of Pro is free</strong> &middot; card required &middot; nothing charged for ${trialDays} days &middot; cancel anytime`
  );
}

/** What Pro adds, in one sentence, from PLAN_CAPABILITIES only. */
function proSummary(proDailyLimit: number): string {
  return `Pro runs up to ${PRO.servers} servers on small, medium or large boxes, with ${fmtInt(proDailyLimit)} tool calls a day, ${PRO.apiKeys} API keys, audit logs kept ${PRO.auditRetentionDays} days, usage export and publishing of your own MCPs.`;
}

// ---- Transactional ---------------------------------------------------------

/** Internal notification for a guided-setup / DPA / security request (/demo). */
export async function sendDemoRequestNotification(data: DemoRequest) {
  const clients = data.clients.map((c) => demoClientLabel(c)).join(", ") || "—";
  const who = headerSafe(data.company || data.name);
  const size = data.teamSize ? ` (${data.teamSize})` : "";
  const result = await getResend().emails.send({
    from: FROM,
    to: SALES_TO,
    replyTo: data.email,
    subject: `TwinMCP ${demoTopicLabel(data.topic).toLowerCase()} request — ${who}${size}`,
    html: cardEmail({
      eyebrow: "Sales",
      title: `New request: ${demoTopicLabel(data.topic)}`,
      body:
        table([
          row("Company", esc(demoCompanyLabel(data))),
          row("Contact", esc(data.name)),
          row("Email", link(`mailto:${esc(data.email)}`, esc(data.email))),
          row("Team size", esc(data.teamSize ?? "—")),
          row("AI clients", esc(clients)),
          row("Language", esc(data.locale)),
        ]) + p(`<em>What they want to automate</em><br/>${esc(data.goal).replace(/\n/g, "<br/>")}`),
    }),
  });
  // The Resend SDK reports failures in the result instead of throwing.
  if (result.error) throw new Error(`Resend: ${result.error.message}`);
  return result;
}

// The acknowledgement goes to an address typed into a public form, so it
// carries NO user-supplied text (no name, no message): it cannot be turned into
// a relay for someone else's content. Replies go to the public contact address.
const DEMO_ACK = {
  en: {
    subject: "We received your TwinMCP request",
    title: "Request received",
    body: "Thank you for writing to TwinMCP. Your request has been passed on and will be answered by email, from a person. If you did not send this request, you can ignore this email: nothing else will be sent.",
    cta: "Read the security page",
    href: "https://twinmcp.fr/security",
    note: "You receive this single email because this address was entered in the request form on twinmcp.fr.",
  },
  fr: {
    subject: "Nous avons bien reçu votre demande TwinMCP",
    title: "Demande reçue",
    body: "Merci d’avoir écrit à TwinMCP. Votre demande a été transmise et recevra une réponse par e-mail, écrite par une personne. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : rien d’autre ne vous sera envoyé.",
    cta: "Lire la page sécurité",
    href: "https://twinmcp.fr/fr/securite",
    note: "Vous recevez cet unique e-mail parce que cette adresse a été saisie dans le formulaire de demande de twinmcp.fr.",
  },
} as const;

/** One-off acknowledgement to the requester of a /demo form. */
export async function sendDemoRequestAcknowledgement(to: string, locale: Locale) {
  const t = DEMO_ACK[locale];
  const result = await getResend().emails.send({
    from: FROM,
    to,
    replyTo: EDITEUR.email,
    subject: t.subject,
    html: cardEmail({
      eyebrow: "TwinMCP",
      title: t.title,
      body: p(esc(t.body)),
      cta: { label: t.cta, href: t.href },
      footerNote: esc(t.note),
    }),
  });
  // The Resend SDK reports failures in the result instead of throwing.
  if (result.error) throw new Error(`Resend: ${result.error.message}`);
  return result;
}

/** Daily admin digest — subject + prebuilt HTML from lib/admin/digest-email. */
export async function sendAdminDigest(to: string, subject: string, html: string) {
  return getResend().emails.send({ from: FROM, to, subject, html });
}

// ---- Activation (welcome + the 24 h reminder share the same four steps) ----

/** "Cursor, Claude Desktop, …, Cline or Zed": the clients the Connect panel writes a config for. */
const CLIENT_LIST = (() => {
  const names = MATRIX_CLIENTS.map((k) => IDE_LABELS[k]);
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`
    : (names[0] ?? "your client");
})();

/**
 * Server → MCP (one that needs no key) → connect the client with the single
 * server URL → ask the assistant to use a tool. The first tool call is the
 * activation moment (users.metadata.firstToolCallAt).
 */
function activationSteps(): string {
  const free = PLAN_CAPABILITIES.free;
  return table([
    row(
      "1 · Server",
      `Create a server: the box your MCPs run on. Free includes ${free.servers} small server.`
    ),
    row(
      "2 · MCP",
      "Add one MCP. Pick one that needs no API key, so there is nothing else to configure: the setup lists only those."
    ),
    row(
      "3 · Connect",
      `Connect ${esc(CLIENT_LIST)} with your server&rsquo;s single URL, <strong>https://twinmcp.fr/api/mcp/&lt;server&gt;</strong>. The server page&rsquo;s Connect panel gives the exact config to paste.`
    ),
    row(
      "4 · Use it",
      "Ask your assistant to use a tool, for example: &ldquo;List the TwinMCP tools you can use, then run one.&rdquo;"
    ),
  ]);
}

export async function sendWelcomeEmail(to: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: "Welcome to TwinMCP",
    html: cardEmail({
      eyebrow: "Account",
      title: "Welcome to TwinMCP",
      body:
        p("Your account is ready. Four steps take you to your assistant&rsquo;s first tool call:") +
        activationSteps(),
      cta: { label: "Start the setup", href: ONBOARDING },
      footerNote: PREFERENCES_NOTE,
    }),
  });
}

/**
 * The activation reminder (lib/billing/nudge-job.ts, kind "activation"): sent
 * once, 24 h after sign-up, when no tool call has gone through yet. A nudge:
 * the job checks users.metadata.emailNudges and the shared cooldown.
 */
export async function sendActivationEmail(to: string): Promise<void> {
  const result = await getResend().emails.send({
    from: FROM,
    to,
    subject: "Four steps to your first TwinMCP tool call",
    html: cardEmail({
      eyebrow: "Setup",
      title: "Your assistant has not used TwinMCP yet",
      body:
        p(
          "Your TwinMCP account is open, but no tool call has gone through it so far. Four steps get it working:"
        ) + activationSteps(),
      cta: { label: "Resume the setup", href: `${ONBOARDING}?force=1` },
      footerNote: PREFERENCES_NOTE,
    }),
  });
  // The Resend SDK reports failures in the result instead of throwing: throw so
  // the job leaves the account unstamped and retries on the next run.
  if (result.error) throw new Error(`Resend: ${result.error.message}`);
}

/**
 * Sent by the Stripe webhook on checkout.session.completed. `trialing` means
 * the first subscription started with the free month: the first invoice only
 * follows the trial, on `periodEnd`.
 */
export async function sendUpgradeConfirmationEmail(
  to: string,
  plan: Plan,
  opts: { trialing?: boolean; periodEnd?: Date | null } = {}
) {
  const label = PLAN_LABELS[plan] ?? plan;
  const trialBody = opts.trialing
    ? p(
        opts.periodEnd
          ? `Your free month runs until <strong>${fmtDay(opts.periodEnd)}</strong>. Nothing is charged before then: the first invoice follows the trial, on that date, at ${PRO_PRICE_LINE}. Cancel from ${link(BILLING, "Billing")} before it ends and you pay nothing.`
          : `Your free month has started. Nothing is charged during the trial: the first invoice follows it, at ${PRO_PRICE_LINE}. Cancel from ${link(BILLING, "Billing")} before it ends and you pay nothing.`
      )
    : "";
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `TwinMCP: Upgraded to ${label}`,
    html: cardEmail({
      eyebrow: "Billing",
      title: `You're now on ${label}`,
      body:
        p(
          `Your new limits are active immediately. Visit your ${link(DASHBOARD, "dashboard")} to see your updated quota.`
        ) + trialBody,
      cta: { label: "Open the dashboard", href: DASHBOARD },
    }),
  });
}

export async function sendPlanDowngradeEmail(to: string, reason: string) {
  const lapsed = reason === "canceled" ? "was canceled" : `lapsed (${esc(reason)})`;
  return getResend().emails.send({
    from: FROM,
    to,
    subject: "TwinMCP: Your plan was downgraded to Free",
    html: cardEmail({
      eyebrow: "Billing",
      title: "Your plan is now Free",
      body:
        p(
          `Your subscription ${lapsed}, so your account is back on the Free plan. Servers beyond the Free limit (1 small server) have been <strong>stopped</strong> — they are not deleted.`
        ) +
        p(
          `${link(PLANS_URL, "Re-subscribe")} to restore them, or manage them in your ${link(DASHBOARD, "dashboard")}.`
        ),
      cta: { label: "Re-subscribe", href: PLANS_URL },
    }),
  });
}

// ---- Upgrade nudges (lib/billing/upgrade-state.ts decides when) ------------
// Each one respects users.metadata.emailNudges (callers check it) and ends
// with the preferences line. Throws when RESEND_API_KEY is missing, like every
// sender here — callers wrap with .catch().

/**
 * The standing offer to a Free account. `trialDays` is 0 when the account has
 * already used its first subscription (no free-month promise then).
 */
export async function sendProOfferEmail(
  to: string,
  opts: { trialDays: number; proDailyLimit: number }
): Promise<void> {
  const eligible = opts.trialDays > 0;
  const title = eligible
    ? "Your first month of TwinMCP Pro is free"
    : "More room to build with Pro";
  await getResend().emails.send({
    from: FROM,
    to,
    subject: title,
    html: cardEmail({
      eyebrow: "Pro",
      title,
      body:
        p(
          `Free gives you ${PLAN_CAPABILITIES.free.servers} small server and ${PLAN_CAPABILITIES.free.apiKeys} API keys, enough to try TwinMCP. ${proSummary(opts.proDailyLimit)}`
        ) +
        p(`Pro is ${PRO_PRICE_LINE}.`) +
        trialLine(opts.trialDays),
      cta: { label: trialCta(eligible).label, href: BILLING },
      footerNote: PREFERENCES_NOTE,
    }),
  });
}

/**
 * Sent once a day (lib/billing/quota-nudge.ts dedups) when a Free account's
 * tool calls start being rejected at the daily quota.
 */
export async function sendQuotaLimitEmail(
  to: string,
  opts: {
    used: number;
    limit: number;
    resetsAt: Date;
    trialDays: number;
    proDailyLimit: number;
  }
): Promise<void> {
  const eligible = opts.trialDays > 0;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Daily limit reached: ${fmtInt(opts.used)} of ${fmtInt(opts.limit)} tool calls`,
    html: cardEmail({
      eyebrow: "Usage",
      title: "You hit today's tool-call limit",
      body:
        p(
          `Your IDE made ${fmtInt(opts.used)} tool calls today, the maximum on the Free plan (${fmtInt(opts.limit)} a day). Tool calls are rejected until the quota resets on ${fmtDayTime(opts.resetsAt)}.`
        ) +
        p(
          `Pro raises the limit to <strong>${fmtInt(opts.proDailyLimit)} tool calls a day</strong>, with up to ${PRO.servers} servers on small, medium or large boxes. It is ${PRO_PRICE_LINE}.`
        ) +
        trialLine(opts.trialDays),
      cta: { label: trialCta(eligible).label, href: BILLING },
      footerNote: PREFERENCES_NOTE,
    }),
  });
}

/**
 * Stripe's customer.subscription.trial_will_end (3 days before the first
 * invoice). States the date, the price and how to stop — nothing else.
 */
export async function sendTrialEndingEmail(
  to: string,
  opts: { endsAt: Date; daysLeft: number }
): Promise<void> {
  const when =
    opts.daysLeft <= 0 ? "today" : `in ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"}`;
  const title = `Your free month of Pro ends ${when}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: title,
    html: cardEmail({
      eyebrow: "Billing",
      title,
      body:
        p(
          `On <strong>${fmtDay(opts.endsAt)}</strong> your free month ends and your Pro subscription continues at the price you chose (${PRO_PRICE_LINE}). That is the first time your card is charged.`
        ) +
        p(
          `Nothing to do to keep Pro. If you would rather stop, cancel from ${link(BILLING, "Billing")} before that date and you pay nothing: your account returns to Free, and servers beyond the Free limit are stopped, not deleted.`
        ),
      cta: { label: "Review my subscription", href: BILLING },
      footerNote: PREFERENCES_NOTE,
    }),
  });
}

/**
 * Stripe's checkout.session.expired, when the abandoned Pro checkout has a
 * recovery link (after_expiration.recovery). One short reminder: what was
 * left, the link, until when it works. The free-month sentence only appears
 * when the recovered session still carries the trial (first subscription,
 * no pre-applied promo) — the webhook decides and passes trialDays.
 */
export async function sendCheckoutRecoveryEmail(
  to: string,
  opts: { url: string; expiresAt: Date | null; proDailyLimit: number; trialDays?: number }
): Promise<void> {
  const until = opts.expiresAt ? ` It works until ${fmtDayTime(opts.expiresAt)}.` : "";
  const trialDays = opts.trialDays ?? 0;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Your TwinMCP Pro checkout is still open",
    html: cardEmail({
      eyebrow: "Billing",
      title: "You left your Pro checkout before the end",
      body:
        p(
          `You started subscribing to TwinMCP Pro and the checkout page timed out before it was finished. Nothing was charged. The button below reopens the same checkout, with the cadence you picked.${until}`
        ) +
        p(`Pro is ${PRO_PRICE_LINE}. ${proSummary(opts.proDailyLimit)}`) +
        trialLine(trialDays) +
        p(
          `Not the right time? Ignore this email: your account stays on Free, with nothing to cancel.`
        ),
      cta: { label: "Resume my checkout", href: opts.url },
      footerNote: PREFERENCES_NOTE,
    }),
  });
}

/**
 * A webhook endpoint was switched off after too many consecutive failed
 * deliveries (lib/webhooks/deliver.ts). Operational, not a nudge: always sent.
 */
export async function sendWebhookDisabledEmail(
  to: string,
  opts: { url: string; failures: number; lastError?: string | null }
): Promise<void> {
  const WEBHOOKS = `${SETTINGS}/webhooks`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: "A TwinMCP webhook endpoint was disabled",
    html: cardEmail({
      eyebrow: "Webhooks",
      title: "We stopped sending to one of your webhook endpoints",
      body:
        p(
          `The last ${fmtInt(opts.failures)} events sent to the endpoint below failed on every retry, so we disabled it. No further events are sent to it until you turn it back on.`
        ) +
        table([
          row("Endpoint", esc(opts.url)),
          ...(opts.lastError ? [row("Last error", esc(opts.lastError))] : []),
        ]) +
        p(
          `Check that the URL is reachable over HTTPS and answers with a 2xx status, then re-enable it and send a test event from ${link(WEBHOOKS, "Settings, Webhooks")}.`
        ),
      cta: { label: "Open webhook settings", href: WEBHOOKS },
    }),
  });
}
