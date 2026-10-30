// Brings the Stripe webhook endpoint's enabled_events in line with the events
// the code handles (HANDLED_STRIPE_EVENTS, src/lib/billing/stripe-events.ts,
// which mirrors the switch in src/app/api/webhooks/stripe/route.ts).
//
// DRY RUN by default: lists the endpoint(s) registered for the URL, what each
// one sends today, what the code handles, and what is missing. Writes nothing.
// --apply adds the missing events to each matching endpoint. It NEVER removes
// an event, never creates an endpoint (a new endpoint would get a new signing
// secret, i.e. a STRIPE_WEBHOOK_SECRET change in Dokploy) and never touches the
// endpoint's API version or URL.
//
// Usage (from apps/backend):
//   pnpm stripe:webhook                              # dry run, https://twinmcp.fr/api/webhooks/stripe
//   pnpm stripe:webhook --apply                      # add the missing events
//   pnpm stripe:webhook https://staging.example/api/webhooks/stripe
//   … --force                                        # allow a test key against the production URL
//
// The mode is the key's: STRIPE_SECRET_KEY from the environment or .env.local.
// Live webhook endpoints are only visible to a live key (sk_live_ / rk_live_
// with "Webhook Endpoints: write"); a test key against twinmcp.fr is refused.

import { config as loadEnv } from "dotenv";
import Stripe from "stripe";
import {
  HANDLED_STRIPE_EVENTS,
  checkWebhookTarget,
  mergedStripeEvents,
  missingStripeEvents,
  parseConfigureArgs,
  sameWebhookUrl,
  stripeKeyMode,
  unhandledStripeEvents,
} from "../src/lib/billing/stripe-events";

loadEnv({ path: ".env.local" });
loadEnv();

function list(label: string, items: readonly string[]): void {
  console.log(`  ${label} (${items.length})`);
  for (const e of items) console.log(`    - ${e}`);
}

const USAGE = `Usage (from apps/backend): pnpm stripe:webhook [url] [--apply] [--force]
  url       webhook endpoint URL (default https://twinmcp.fr/api/webhooks/stripe)
  --apply   add the missing events (default: dry run, writes nothing)
  --force   allow a test-mode key against the production URL
STRIPE_SECRET_KEY comes from the environment or .env.local (live key for twinmcp.fr).`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return;
  }
  const args = parseConfigureArgs(argv);
  const key = process.env.STRIPE_SECRET_KEY;
  const guard = checkWebhookTarget({ key, url: args.url, force: args.force });
  if (!guard.ok) {
    console.error(`[stripe:webhook] ${guard.reason}`);
    process.exit(1);
  }
  if (guard.warning) console.warn(`[stripe:webhook] WARNING: ${guard.warning}`);

  const stripe = new Stripe(key!, { apiVersion: "2026-03-25.dahlia" });
  console.log(
    `[stripe:webhook] ${args.apply ? "APPLY" : "DRY RUN"} · ${stripeKeyMode(key)} key · ${args.url}`
  );
  console.log("");
  list("events the code handles", HANDLED_STRIPE_EVENTS);
  console.log("");

  const all: Stripe.WebhookEndpoint[] = [];
  for await (const ep of stripe.webhookEndpoints.list({ limit: 100 })) all.push(ep);
  const matching = all.filter((ep) => sameWebhookUrl(ep.url, args.url));

  if (matching.length === 0) {
    console.error(`[stripe:webhook] no webhook endpoint for ${args.url} in this Stripe account.`);
    if (all.length > 0) {
      console.error("  endpoints that do exist:");
      for (const ep of all) console.error(`    ${ep.id}  ${ep.status}  ${ep.url}`);
    }
    console.error(
      "  Create it in Stripe → Developers → Webhooks (then put its signing secret in Dokploy as STRIPE_WEBHOOK_SECRET), and re-run."
    );
    process.exit(1);
  }
  if (matching.length > 1) {
    console.warn(
      `[stripe:webhook] WARNING: ${matching.length} endpoints share this URL; only one signing secret can match STRIPE_WEBHOOK_SECRET.`
    );
  }

  let failures = 0;
  for (const ep of matching) {
    const enabled = [...ep.enabled_events];
    const missing = missingStripeEvents(enabled);
    const unhandled = unhandledStripeEvents(enabled);
    console.log(
      `endpoint ${ep.id} · status ${ep.status} · api_version ${ep.api_version ?? "(account default)"}`
    );
    if (ep.status !== "enabled") {
      console.warn("  WARNING: this endpoint is DISABLED: Stripe delivers nothing to it.");
    }
    list("currently enabled", enabled);
    list("missing (would be added)", missing);
    if (unhandled.length > 0) list("enabled but not handled (kept, harmless)", unhandled);

    if (missing.length === 0) {
      console.log("  up to date: nothing to add.");
    } else if (!args.apply) {
      console.log("  dry run: re-run with --apply to add the missing events.");
    } else {
      try {
        const next = mergedStripeEvents(enabled);
        const updated = await stripe.webhookEndpoints.update(ep.id, {
          enabled_events: next as Stripe.WebhookEndpointUpdateParams.EnabledEvent[],
        });
        const still = missingStripeEvents(updated.enabled_events);
        list("enabled after update", updated.enabled_events);
        if (still.length > 0) {
          failures++;
          list("STILL missing after update", still);
        } else {
          console.log(`  updated: ${missing.length} event(s) added, none removed.`);
        }
      } catch (err) {
        failures++;
        console.error(`  ERROR updating ${ep.id}:`, err instanceof Error ? err.message : err);
      }
    }
    console.log("");
  }
  process.exit(failures > 0 ? 2 : 0);
}

if (/configure-stripe-webhook\.[cm]?[jt]s$/.test(process.argv[1] ?? "")) {
  main().catch((err) => {
    console.error("[stripe:webhook] failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
