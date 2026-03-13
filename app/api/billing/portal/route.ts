import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateAuth } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';
import {
  createCustomerPortalSession,
  isStripeConfigured,
} from '@/lib/services/stripe-billing.service';

/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session so the user can manage
 * their subscription, payment methods, and invoices directly in Stripe.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: 'Service de paiement non configuré' }, { status: 503 });
    }

    const auth = await validateAuth(req.headers.get('authorization'));
    if (!auth.valid || !auth.userId) {
      throw new AuthenticationError();
    }

    // Find user profile
    const dbUser = await prisma.user.findFirst({
      where: { OR: [{ id: auth.userId }, { oauthId: auth.userId }] },
      include: { profile: true },
    });

    if (!dbUser?.profile) {
      return NextResponse.json({ error: 'Profil utilisateur non trouvé' }, { status: 404 });
    }

    // Guard against oversized bodies — this route only needs a small returnUrl field
    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    if (contentLength > 2048) {
      return NextResponse.json({ error: 'Requête trop volumineuse' }, { status: 413 });
    }
    const body = await req.json().catch(() => ({}));
    const defaultReturn = `${req.nextUrl.origin}/dashboard/billing`;

    // Validate returnUrl is same-origin to prevent open redirect attacks
    let returnUrl = defaultReturn;
    if (body.returnUrl && typeof body.returnUrl === 'string' && body.returnUrl.length <= 2048) {
      try {
        const parsed = new URL(body.returnUrl);
        if (parsed.origin === req.nextUrl.origin) {
          returnUrl = body.returnUrl;
        }
      } catch {
        // Invalid URL — use default
      }
    }

    // Pre-check: avoid calling Stripe if no customer ID exists — gives a clear error
    if (!dbUser.profile.stripeCustomerId) {
      return NextResponse.json(
        {
          error: "Aucun abonnement Stripe trouvé. Souscrivez d'abord un plan Pro.",
          code: 'NO_CUSTOMER',
        },
        { status: 400 }
      );
    }

    const url = await createCustomerPortalSession(dbUser.profile.id, returnUrl);

    return NextResponse.json({ url });
  } catch (error) {
    return handleApiError(error, 'BillingPortal');
  }
}
