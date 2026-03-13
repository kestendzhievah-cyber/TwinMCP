import { logger } from '@/lib/logger';
import { authenticateRequest } from '@/lib/middleware/auth-middleware';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handleApiError } from '@/lib/api-error-handler';

// Cached Stripe client singleton for diagnostic route
let _stripe: Stripe | null = null;
let _stripeKey: string | null = null;
function getCachedStripe(key: string): Stripe {
  if (!_stripe || _stripeKey !== key) {
    _stripe = new Stripe(key);
    _stripeKey = key;
  }
  return _stripe;
}

type CheckStatus = 'ok' | 'warn' | 'fail';

type DiagnosticCheck = {
  name: string;
  status: CheckStatus;
  message: string;
  metadata?: Record<string, unknown>;
};

function getKeyMode(key: string): 'live' | 'test' | 'unknown' {
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  return 'unknown';
}

function maskSecret(value: string): string {
  if (!value || value.length < 10) return '****';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function ensureAdmin(request: NextRequest): Promise<NextResponse | null> {
  const adminKey = request.headers.get('x-admin-key');
  const configuredAdminKey = process.env.ADMIN_SECRET_KEY;

  if (configuredAdminKey && adminKey) {
    // Use timing-safe comparison to prevent timing attacks.
    // Pad both to same length so timingSafeEqual never throws and
    // we don't leak length info via an early-exit path.
    const { timingSafeEqual, createHmac } = await import('crypto');
    const hmac = (v: string) => createHmac('sha256', 'admin-key-cmp').update(v).digest();
    if (timingSafeEqual(hmac(adminKey), hmac(configuredAdminKey))) {
      return null;
    }
    // Admin key was provided but incorrect — reject immediately
    return NextResponse.json(
      { success: false, error: 'Invalid admin key', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  const { context, error } = await authenticateRequest(request, {
    required: true,
    allowApiKey: false,
    rateLimitConfig: 'api',
  });

  if (error) return error;

  if (context.user?.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Admin access required', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  const unauthorized = await ensureAdmin(request);
  if (unauthorized) return unauthorized;

  const checks: DiagnosticCheck[] = [];
  const secretKey = process.env.STRIPE_SECRET_KEY || '';
  const keyMode = getKeyMode(secretKey);

  if (!secretKey) {
    checks.push({
      name: 'stripe_secret_key',
      status: 'fail',
      message: 'STRIPE_SECRET_KEY est manquante',
    });

    return NextResponse.json(
      {
        success: true,
        overallStatus: 'fail',
        checks,
        summary: 'Configuration Stripe incomplète',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  if (keyMode === 'unknown') {
    checks.push({
      name: 'stripe_secret_key_format',
      status: 'fail',
      message: 'STRIPE_SECRET_KEY doit commencer par sk_test_ ou sk_live_',
      metadata: { keyPreview: maskSecret(secretKey) },
    });

    return NextResponse.json(
      {
        success: true,
        overallStatus: 'fail',
        checks,
        summary: 'Format de clé Stripe invalide',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }

  checks.push({
    name: 'stripe_secret_key',
    status: 'ok',
    message: 'Clé Stripe présente',
    metadata: { mode: keyMode, keyPreview: maskSecret(secretKey) },
  });

  const stripe = getCachedStripe(secretKey);

  try {
    const account = await stripe.accounts.retrieve();

    checks.push({
      name: 'stripe_authentication',
      status: 'ok',
      message: 'Authentification Stripe valide',
      metadata: {
        accountId: account.id,
        keyMode,
      },
    });
  } catch (error) {
    logger.error('[Stripe Diagnostic] Account check failed:', error);

    checks.push({
      name: 'stripe_authentication',
      status: 'fail',
      message: 'Authentification Stripe échouée',
    });
  }

  const priceVars = [
    { envKey: 'STRIPE_PRO_MONTHLY_PRICE_ID', label: 'pro_monthly_price' },
    { envKey: 'STRIPE_PRO_YEARLY_PRICE_ID', label: 'pro_yearly_price' },
  ];

  for (const item of priceVars) {
    const priceId = process.env[item.envKey];

    if (!priceId) {
      checks.push({
        name: item.label,
        status: 'fail',
        message: `${item.envKey} est manquante`,
      });
      continue;
    }

    try {
      const price = await stripe.prices.retrieve(priceId);
      const priceMode = price.livemode ? 'live' : 'test';
      const modeMatches = priceMode === keyMode;

      checks.push({
        name: item.label,
        status: modeMatches ? 'ok' : 'fail',
        message: modeMatches
          ? `${item.envKey} est valide`
          : `${item.envKey} est en mode ${priceMode} mais la clé est en mode ${keyMode}`,
        metadata: {
          priceId,
          active: price.active,
          recurringInterval: price.recurring?.interval || null,
          unitAmount: price.unit_amount,
          currency: price.currency,
          mode: priceMode,
        },
      });

      if (!price.active) {
        checks.push({
          name: `${item.label}_active`,
          status: 'warn',
          message: `${item.envKey} existe mais le price Stripe est inactif`,
          metadata: { priceId },
        });
      }
    } catch (error) {
      checks.push({
        name: item.label,
        status: 'fail',
        message: `Impossible de récupérer ${item.envKey}`,
        metadata: { priceId },
      });
    }
  }

  const hasFailure = checks.some(check => check.status === 'fail');
  const hasWarning = checks.some(check => check.status === 'warn');
  const overallStatus: CheckStatus = hasFailure ? 'fail' : hasWarning ? 'warn' : 'ok';

  return NextResponse.json({
    success: true,
    overallStatus,
    checks,
    summary:
      overallStatus === 'ok'
        ? 'Configuration Stripe valide'
        : overallStatus === 'warn'
          ? 'Configuration Stripe valide avec avertissements'
          : 'Configuration Stripe invalide',
    timestamp: new Date().toISOString(),
  });
}
