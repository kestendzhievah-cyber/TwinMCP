import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  _resend = new Resend(key);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "TwinMCP <noreply@twinmcp.com>";

export async function sendWelcomeEmail(to: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: "Welcome to TwinMCP",
    html: `<h2>Welcome to TwinMCP!</h2>
<p>Your account is ready. Head to your <a href="https://twinmcp.com/dashboard">dashboard</a> to create an API key and start using TwinMCP.</p>`,
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
<p><a href="https://twinmcp.com/plans">Upgrade your plan</a> for higher limits.</p>`,
  });
}

export async function sendUpgradeConfirmationEmail(to: string, plan: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `TwinMCP: Upgraded to ${plan}`,
    html: `<h2>You're now on ${plan}!</h2>
<p>Your new limits are active immediately. Visit your <a href="https://twinmcp.com/dashboard">dashboard</a> to see your updated quota.</p>`,
  });
}
