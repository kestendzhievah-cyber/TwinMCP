import { Resend } from "resend";
import { cardEmail, esc, link, p, row, table } from "./email-layout";

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
const PLANS = "https://twinmcp.fr/plans";

export async function sendSalesInquiry(data: {
  company: string;
  name: string;
  email: string;
  users: number;
  message?: string;
}) {
  return getResend().emails.send({
    from: FROM,
    to: SALES_TO,
    replyTo: data.email,
    subject: `TwinMCP Team inquiry — ${data.company} (${data.users} users)`,
    html: cardEmail({
      eyebrow: "Sales",
      title: "New Team / Enterprise inquiry",
      body:
        table([
          row("Company", esc(data.company)),
          row("Contact", esc(data.name)),
          row("Email", link(`mailto:${esc(data.email)}`, esc(data.email))),
          row("Users", String(data.users)),
        ]) +
        (data.message
          ? p(`<em>Message</em><br/>${esc(data.message).replace(/\n/g, "<br/>")}`)
          : ""),
    }),
  });
}

/** Daily admin digest — subject + prebuilt HTML from lib/admin/digest-email. */
export async function sendAdminDigest(to: string, subject: string, html: string) {
  return getResend().emails.send({ from: FROM, to, subject, html });
}

export async function sendWelcomeEmail(to: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: "Welcome to TwinMCP",
    html: cardEmail({
      eyebrow: "Account",
      title: "Welcome to TwinMCP",
      body: p(
        `Your account is ready. Head to your ${link(DASHBOARD, "dashboard")} to create an API key and start using TwinMCP.`
      ),
      cta: { label: "Open the dashboard", href: DASHBOARD },
    }),
  });
}

export async function sendQuotaWarningEmail(to: string, usage: number, limit: number) {
  const pct = Math.round((usage / limit) * 100);
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `TwinMCP: You've used ${pct}% of your daily quota`,
    html: cardEmail({
      eyebrow: "Usage",
      title: `Quota usage: ${pct}%`,
      body:
        p(`You've used ${usage} of your ${limit} daily requests.`) +
        p(`${link(PLANS, "Upgrade your plan")} for higher limits.`),
      cta: { label: "See plans", href: PLANS },
    }),
  });
}

export async function sendUpgradeConfirmationEmail(to: string, plan: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `TwinMCP: Upgraded to ${plan}`,
    html: cardEmail({
      eyebrow: "Billing",
      title: `You're now on ${plan}`,
      body: p(
        `Your new limits are active immediately. Visit your ${link(DASHBOARD, "dashboard")} to see your updated quota.`
      ),
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
          `${link(PLANS, "Re-subscribe")} to restore them, or manage them in your ${link(DASHBOARD, "dashboard")}.`
        ),
      cta: { label: "Re-subscribe", href: PLANS },
    }),
  });
}
