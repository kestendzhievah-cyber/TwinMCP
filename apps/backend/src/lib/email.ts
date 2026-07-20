import { Resend } from "resend";

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

/** Minimal HTML escape so form values can't inject markup into the email. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
    html: `<h2>New Team / Enterprise inquiry</h2>
<ul>
  <li><strong>Company:</strong> ${esc(data.company)}</li>
  <li><strong>Contact:</strong> ${esc(data.name)}</li>
  <li><strong>Email:</strong> ${esc(data.email)}</li>
  <li><strong>Number of users:</strong> ${data.users}</li>
</ul>
${data.message ? `<p><strong>Message:</strong><br/>${esc(data.message).replace(/\n/g, "<br/>")}</p>` : ""}`,
  });
}

export async function sendWelcomeEmail(to: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: "Welcome to TwinMCP",
    html: `<h2>Welcome to TwinMCP!</h2>
<p>Your account is ready. Head to your <a href="https://twinmcp.fr/dashboard">dashboard</a> to create an API key and start using TwinMCP.</p>`,
  });
}

export async function sendQuotaWarningEmail(to: string, usage: number, limit: number) {
  const pct = Math.round((usage / limit) * 100);
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `TwinMCP: You've used ${pct}% of your daily quota`,
    html: `<h2>Quota usage: ${pct}%</h2>
<p>You've used ${usage} of your ${limit} daily requests.</p>
<p><a href="https://twinmcp.fr/plans">Upgrade your plan</a> for higher limits.</p>`,
  });
}

export async function sendUpgradeConfirmationEmail(to: string, plan: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `TwinMCP: Upgraded to ${plan}`,
    html: `<h2>You're now on ${plan}!</h2>
<p>Your new limits are active immediately. Visit your <a href="https://twinmcp.fr/dashboard">dashboard</a> to see your updated quota.</p>`,
  });
}

export async function sendPlanDowngradeEmail(to: string, reason: string) {
  const lapsed = reason === "canceled" ? "was canceled" : `lapsed (${reason})`;
  return getResend().emails.send({
    from: FROM,
    to,
    subject: "TwinMCP: Your plan was downgraded to Free",
    html: `<h2>Your plan is now Free</h2>
<p>Your subscription ${lapsed}, so your account is back on the Free plan. Servers beyond the Free limit (1 small server) have been <strong>stopped</strong> — they are not deleted.</p>
<p><a href="https://twinmcp.fr/plans">Re-subscribe</a> to restore them, or manage them in your <a href="https://twinmcp.fr/dashboard">dashboard</a>.</p>`,
  });
}
