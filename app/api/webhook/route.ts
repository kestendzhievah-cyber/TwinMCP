import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Vérification des variables d'environnement
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

// Vérification des variables d'environnement au démarrage
if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY is not set in environment variables')
  throw new Error('STRIPE_SECRET_KEY is not configured')
}

if (!endpointSecret) {
  console.error('❌ STRIPE_WEBHOOK_SECRET is not set in environment variables')
  throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
}

// Initialisation du client Stripe avec la version d'API la plus récente
const stripe = new Stripe(stripeSecretKey, {
  // Ne pas spécifier de version pour utiliser la version par défaut du SDK
  typescript: true,
})

// Interface pour les métadonnées de journalisation
interface WebhookLog {
  eventId: string
  type: string
  status: 'success' | 'error'
  message: string
  timestamp: string
  metadata?: Record<string, any>
}

// Fonction utilitaire pour la journalisation
const logWebhookEvent = (log: Omit<WebhookLog, 'timestamp'>) => {
  const logEntry: WebhookLog = {
    ...log,
    timestamp: new Date().toISOString(),
  }
  
  // En production, vous pourriez envoyer ces logs à un service comme Sentry, LogRocket, etc.
  if (log.status === 'error') {
    console.error('🔴 Webhook Error:', logEntry)
  } else {
    console.log('🟢 Webhook Log:', logEntry)
  }
  
  // Ici, vous pourriez également enregistrer dans une base de données
  // await db.webhookLogs.create({ data: logEntry })
}

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(2, 9)
  const startTime = Date.now()
  
  try {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature')
    
    if (!sig) {
      logWebhookEvent({
        eventId: requestId,
        type: 'signature_missing',
        status: 'error',
        message: 'Missing Stripe signature header',
      })
      return NextResponse.json(
        { error: 'Missing Stripe signature' },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, sig!, endpointSecret!)
      
      // Type guard pour vérifier si l'event a un objet de type Subscription
      const isSubscriptionEvent = (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      )
      
      logWebhookEvent({
        eventId: requestId,
        type: 'webhook_received',
        status: 'success',
        message: `Received event: ${event.type}`,
        metadata: {
          eventId: event.id,
          type: event.type,
          apiVersion: event.api_version,
          // Inclure des métadonnées spécifiques au type d'événement
          ...(isSubscriptionEvent ? {
            subscriptionId: (event.data.object as Stripe.Subscription).id,
            customerId: (event.data.object as Stripe.Subscription).customer
          } : {})
        },
      })
      
    } catch (err) {
      const error = err as Error
      logWebhookEvent({
        eventId: requestId,
        type: 'signature_verification_failed',
        status: 'error',
        message: 'Webhook signature verification failed',
        metadata: {
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
      })
      
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Traitement des événements
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription
          // Mettez à jour la base de données avec les informations d'abonnement
          
          logWebhookEvent({
            eventId: requestId,
            type: 'subscription_updated',
            status: 'success',
            message: `Subscription ${event.type.split('.').pop()}`,
            metadata: {
              subscriptionId: subscription.id,
              customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || 'unknown',
              status: subscription.status,
              // Utilisation de la propriété current_period_end du type Stripe.Subscription
              currentPeriodEnd: 'current_period_end' in subscription ? 
                (subscription as any).current_period_end?.toString() || 'unknown' : 'unknown',
            },
          })
          break
        }
          
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice
          // Mettez à jour la base de données pour refléter le paiement réussi
          
          // Récupérer l'ID d'abonnement à partir des lignes de facture
          const subscriptionId = invoice.lines.data[0]?.subscription || null
          
          logWebhookEvent({
            eventId: requestId,
            type: 'payment_succeeded',
            status: 'success',
            message: `Payment received for invoice ${invoice.id}`,
            metadata: {
              invoiceId: invoice.id,
              amount: invoice.amount_paid,
              customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || 'unknown',
              subscriptionId: subscriptionId,
            },
          })
          break
        }
          
        case 'invoice.payment_failed': {
          const failedInvoice = event.data.object as Stripe.Invoice
          // Notifiez l'utilisateur ou effectuez d'autres actions en cas d'échec de paiement
          
          // Récupérer l'ID d'abonnement à partir des lignes de facture
          const subscriptionId = failedInvoice.lines.data[0]?.subscription || null
          
          logWebhookEvent({
            eventId: requestId,
            type: 'payment_failed',
            status: 'error',
            message: `Payment failed for invoice ${failedInvoice.id}`,
            metadata: {
              invoiceId: failedInvoice.id,
              attempt: failedInvoice.attempt_count,
              customerId: typeof failedInvoice.customer === 'string' ? failedInvoice.customer : failedInvoice.customer?.id || 'unknown',
              subscriptionId: subscriptionId,
            },
          })
          break
        }
          
        default:
          logWebhookEvent({
            eventId: requestId,
            type: 'unhandled_event',
            status: 'success',
            message: `Unhandled event type: ${event.type}`,
            metadata: {
              eventType: event.type,
            },
          })
      }

      return NextResponse.json({ 
        received: true,
        eventId: requestId,
        eventType: event.type,
        processedIn: `${Date.now() - startTime}ms`
      })
      
    } catch (error) {
      const err = error as Error
      logWebhookEvent({
        eventId: requestId,
        type: 'processing_error',
        status: 'error',
        message: 'Error processing webhook event',
        metadata: {
          error: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
          eventType: event.type,
        },
      })
      
      return NextResponse.json(
        { 
          error: 'Error processing webhook',
          eventId: requestId,
        },
        { status: 500 }
      )
    }
    
  } catch (error) {
    const err = error as Error
    logWebhookEvent({
      eventId: requestId,
      type: 'unexpected_error',
      status: 'error',
      message: 'Unexpected error in webhook handler',
      metadata: {
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
    })
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        eventId: requestId,
      },
      { status: 500 }
    )
  }
}
