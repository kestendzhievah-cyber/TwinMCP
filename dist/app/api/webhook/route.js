"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
async function POST(req) {
    try {
        const body = await req.text();
        const sig = req.headers.get('stripe-signature');
        let event;
        try {
            event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
        }
        catch (err) {
            console.error('Erreur de signature webhook:', err);
            return server_1.NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
        }
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                const subscription = event.data.object;
                // Handle subscription changes (e.g., update database)
                console.log('Subscription updated:', subscription.id);
                break;
            case 'invoice.payment_succeeded':
                const invoice = event.data.object;
                // Handle successful payment
                console.log('Payment succeeded for invoice:', invoice.id);
                break;
            case 'invoice.payment_failed':
                const failedInvoice = event.data.object;
                // Handle failed payment
                console.log('Payment failed for invoice:', failedInvoice.id);
                break;
            default:
                console.log('Unhandled event type:', event.type);
        }
        return server_1.NextResponse.json({ received: true });
    }
    catch (error) {
        console.error('Erreur webhook:', error);
        return server_1.NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map