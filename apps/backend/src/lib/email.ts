import { Resend } from "resend";
import type { Plan } from "@/db/schema/core";
import { PLAN_CAPABILITIES, PLAN_LABELS } from "@/lib/plan-features";
import { cardEmail, esc, link, p, row, table } from "./email-layout";
import type { Locale } from "@/lib/i18n/locales";
import { EDITEUR } from "@/lib/legal/entity";
import { IDE_LABELS, MATRIX_CLIENTS } from "@/lib/mcp/client-config";
import { minTopupLabel } from "@/lib/wallet/pricing";
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
const BILLING = "https://twinmcp.fr/dashboard/billing";
const SETTINGS = "https://twinmcp.fr/dashboard/settings";
const ONBOARDING = "https://twinmcp.fr/onboarding";

/**
 * Closing line of every lifecycle ("nudge") email — why it arrived and where to
 * stop them (users.metadata.emailNudges, PATCH /api/v2/users/me/preferences).
 */
const PREFERENCES_NOTE = `You receive this because you have a TwinMCP account. Manage email preferences: ${link(`${SETTINGS}#email-notifications`, SETTINGS)}`;

/**
 * Closing line of the money-critical wallet emails (zero balance, failed
 * auto-recharge, runtime deletion, subscription conversion, top-up receipt):
 * they are always sent, whatever the email preferences say.
 */
const ACCOUNT_NOTE =
  "You receive this email because it concerns the credit balance of your TwinMCP account.";

const PRO = PLAN_CAPABILITIES.pro;

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

/** Throws on a Resend error so callers (notify, the nudge job) can retry. */
async function send(to: string, subject: string, html: string): Promise<void> {
  const result = await getResend().emails.send({ from: FROM, to, subject, html });
  // The Resend SDK reports failures in the result instead of throwing.
  if (result.error) throw new Error(`Resend: ${result.error.message}`);
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
      `Create a server: the box your MCPs run on. Free credit runs ${free.servers} small server.`
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
 * Sent by the Stripe webhook on checkout.session.completed of a legacy Pro
 * subscription checkout. `trialing` means the subscription started with the
 * free month: the first invoice only follows the trial, on `periodEnd`.
 *
 * @deprecated Subscriptions are no longer sold (prepaid credit since
 * 2026-10-29). Kept while the webhook still handles legacy sessions.
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
          ? `Your free month runs until <strong>${fmtDay(opts.periodEnd)}</strong>. Nothing is charged before then. Cancel from ${link(BILLING, "Billing")} before it ends and you pay nothing.`
          : `Your free month has started. Nothing is charged during the trial. Cancel from ${link(BILLING, "Billing")} before it ends and you pay nothing.`
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
          `Your new limits are active immediately. Visit your ${link(DASHBOARD, "dashboard")} to see them.`
        ) + trialBody,
      cta: { label: "Open the dashboard", href: DASHBOARD },
    }),
  });
}

// ---- Wallet (lib/wallet/notify.ts decides when and dedupes) -----------------
// Amounts arrive already formatted (lib/billing/upgrade-state.ts formatCredit)
// so every surface shows the same figures. Each sender throws on a Resend
// error: notify releases its dedupe stamp and the next trigger retries.

export interface SignupCreditEmail {
  /** "€10.00". */
  amount: string;
  expiresAt: Date | null;
  /** What the credit pays for, each line assuming it all goes to that one item. */
  examples: string[];
  /** "€0.10" per 1,000 tool calls. */
  per1000Calls: string;
  /** "€10.00", the smallest top-up. */
  minTopup: string;
}

/** The free sign-up credit landed: what it buys, then the four setup steps. */
export async function sendSignupCreditEmail(to: string, opts: SignupCreditEmail): Promise<void> {
  const until = opts.expiresAt ? `, valid until <strong>${fmtDay(opts.expiresAt)}</strong>` : "";
  const examples = opts.examples.length
    ? table(opts.examples.map((e, i) => row(i === 0 ? "It buys" : "or", esc(e))))
    : "";
  await send(
    to,
    `${opts.amount} of free TwinMCP credit is on your account`,
    cardEmail({
      eyebrow: "Credit",
      title: `${opts.amount} of free credit is on your account`,
      body:
        p(
          `Your account has ${esc(opts.amount)} of free credit${until}. No card needed. It pays for what you use: tool calls that reach your MCPs (${esc(opts.per1000Calls)} per 1,000) and the active CPU time of your server.`
        ) +
        examples +
        p(
          `Free credit runs ${PLAN_CAPABILITIES.free.servers} small server; MCPs that run arbitrary code (shell, code execution, headless browser) need a first top-up, from ${esc(opts.minTopup)}. There is no subscription.`
        ) +
        p("Four steps take you to your assistant&rsquo;s first tool call:") +
        activationSteps(),
      cta: { label: "Start the setup", href: ONBOARDING },
      footerNote: PREFERENCES_NOTE,
    })
  );
}

/** The balance dropped below the low-balance line. A nudge (respects preferences). */
export async function sendLowBalanceEmail(
  to: string,
  opts: { balance: string; autoRecharge: boolean }
): Promise<void> {
  await send(
    to,
    `Your TwinMCP credit is running low: ${opts.balance} left`,
    cardEmail({
      eyebrow: "Credit",
      title: "Your credit is running low",
      body:
        p(
          `Your TwinMCP balance is <strong>${esc(opts.balance)}</strong>. When it reaches zero, tool calls from your assistant are refused until you add credit.`
        ) +
        p(
          opts.autoRecharge
            ? "Auto-recharge is on: your saved card is charged when the balance drops below your threshold, within your monthly cap."
            : `Top up from ${link(BILLING, "Billing")}, or turn on auto-recharge there so your balance refills on its own, with a monthly cap you choose.`
        ),
      cta: { label: "Add credit", href: BILLING },
      footerNote: PREFERENCES_NOTE,
    })
  );
}

/** The balance hit zero. Money-critical: always sent. */
export async function sendZeroBalanceEmail(
  to: string,
  opts: { funded: boolean; deleteAfterDays?: number | null; promoExpired?: boolean }
): Promise<void> {
  const deletion =
    !opts.funded && opts.deleteAfterDays
      ? p(
          `Without credit, the runtime of your server is deleted after ${opts.deleteAfterDays} days. Its configuration (installed MCPs and their settings) is kept, so you can start again at any time.`
        )
      : "";
  await send(
    to,
    opts.promoExpired ? "Your free TwinMCP credit has expired" : "Your TwinMCP credit is used up",
    cardEmail({
      eyebrow: "Credit",
      title: opts.promoExpired
        ? "Your free credit has expired"
        : opts.funded
          ? "Your credit is used up"
          : "Your free credit is used up",
      body:
        p(
          `${opts.promoExpired ? "Your free credit reached its expiry date, so your" : "Your"} TwinMCP balance is now zero. Tool calls from your assistant are refused and your servers are paused until you add credit. Your servers, their MCPs and settings are kept.`
        ) +
        deletion +
        p(
          `Top-ups start at ${minTopupLabel()} and take effect as soon as the payment goes through.`
        ),
      cta: { label: "Top up", href: BILLING },
      footerNote: esc(ACCOUNT_NOTE),
    })
  );
}

/** The free sign-up credit expires soon (7 days, then 2 days before). A nudge. */
export async function sendPromoExpiringEmail(
  to: string,
  opts: { remaining: string; expiresAt: Date; daysLeft: number; funded: boolean }
): Promise<void> {
  const when =
    opts.daysLeft <= 0 ? "today" : `in ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"}`;
  await send(
    to,
    `Your free TwinMCP credit expires ${when}`,
    cardEmail({
      eyebrow: "Credit",
      title: `Your free credit expires ${when}`,
      body:
        p(
          `You have <strong>${esc(opts.remaining)}</strong> of free credit left. It expires on ${fmtDayTime(opts.expiresAt)}; whatever is unused then is removed from your balance.`
        ) +
        p(
          opts.funded
            ? "The credit you bought is not affected."
            : `To keep your server running after that date, add credit from ${link(BILLING, "Billing")} (from ${minTopupLabel()}). A first top-up also unlocks up to ${PRO.servers} servers on every box size.`
        ),
      cta: { label: opts.funded ? "See my credit" : "Add credit", href: BILLING },
      footerNote: PREFERENCES_NOTE,
    })
  );
}

/** An automatic top-up was declined. Money-critical: always sent. */
export async function sendAutoRechargeFailedEmail(
  to: string,
  opts: { amount: string | null; reason?: string | null }
): Promise<void> {
  const what = opts.amount ? `add ${esc(opts.amount)} to` : "top up";
  const why = opts.reason ? ` The payment provider said: &ldquo;${esc(opts.reason)}&rdquo;.` : "";
  await send(
    to,
    "TwinMCP auto-recharge could not charge your card",
    cardEmail({
      eyebrow: "Credit",
      title: "Auto-recharge could not charge your card",
      body:
        p(
          `We tried to ${what} your TwinMCP balance with your saved card, and the payment failed.${why}`
        ) +
        p(
          `Top up once from ${link(BILLING, "Billing")} with a working card (tick &ldquo;save this card&rdquo; to use it for auto-recharge). When the balance reaches zero, tool calls are refused until credit is added.`
        ),
      cta: { label: "Top up", href: BILLING },
      footerNote: esc(ACCOUNT_NOTE),
    })
  );
}

/**
 * An account without paid credit is at zero: its server runtimes are deleted
 * on `deleteAt`. Sent on day 0, 7 and 13 of that period. Money-critical.
 */
export async function sendRuntimeDeletionWarningEmail(
  to: string,
  opts: { stage: number; deleteAt: Date; serverCount: number }
): Promise<void> {
  const servers =
    opts.serverCount === 1 ? "your server" : `your ${fmtInt(opts.serverCount)} servers`;
  const title =
    opts.stage >= 13
      ? "Your server runtime is deleted tomorrow"
      : `Your server runtime will be deleted on ${fmtDay(opts.deleteAt)}`;
  await send(
    to,
    title,
    cardEmail({
      eyebrow: "Credit",
      title,
      body:
        p(
          `Your TwinMCP balance is at zero, so ${servers} cannot run. On <strong>${fmtDayTime(opts.deleteAt)}</strong> the runtime of ${servers} is deleted to free the machine.`
        ) +
        p(
          "The configuration is kept: installed MCPs and their settings stay on your account, and the runtime is rebuilt when you start the server again."
        ) +
        p(`Add credit before that date (from ${minTopupLabel()}) and nothing is deleted.`),
      cta: { label: "Add credit", href: BILLING },
      footerNote: esc(ACCOUNT_NOTE),
    })
  );
}

/** A legacy subscription was converted into credit by the owner-run script. Money-critical. */
export async function sendSubscriptionConvertedEmail(
  to: string,
  opts: { credited: string; plan: string; balance: string }
): Promise<void> {
  await send(
    to,
    "Your TwinMCP subscription is now credit",
    cardEmail({
      eyebrow: "Billing",
      title: "Your subscription is now credit",
      body:
        p(
          `TwinMCP no longer sells subscriptions: you pay for what you use, from a prepaid balance. Your ${esc(opts.plan)} subscription has been cancelled, and the unused part of the period you had paid, <strong>${esc(opts.credited)}</strong>, has been added to your balance.`
        ) +
        table([row("Credited", esc(opts.credited)), row("Balance", esc(opts.balance))]) +
        p(
          `There is nothing to do: you will not be charged for the subscription again, and your servers keep running while you have credit. To never run out, turn on auto-recharge in ${link(BILLING, "Billing")}.`
        ),
      cta: { label: "See my credit", href: BILLING },
      footerNote: esc(ACCOUNT_NOTE),
    })
  );
}

/** A paid top-up was credited. Transactional: always sent. */
export async function sendTopupSucceededEmail(
  to: string,
  opts: { amount: string; balance: string }
): Promise<void> {
  await send(
    to,
    `${opts.amount} added to your TwinMCP credit`,
    cardEmail({
      eyebrow: "Credit",
      title: `${opts.amount} added to your credit`,
      body:
        p(`Your top-up went through. Thank you.`) +
        table([row("Added", esc(opts.amount)), row("Balance", esc(opts.balance))]) +
        p(`Your balance and its history are on ${link(BILLING, "Billing")}.`),
      cta: { label: "See my credit", href: BILLING },
      footerNote: esc(ACCOUNT_NOTE),
    })
  );
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
