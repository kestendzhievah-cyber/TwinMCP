"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const server_1 = require("next/server");
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY);
async function POST(req) {
    try {
        const body = await req.json();
        const { priceId, customerEmail } = body;
        if (!priceId || !customerEmail) {
            return server_1.NextResponse.json({ error: 'Price ID et email requis' }, { status: 400 });
        }
        // Create or retrieve customer
        let customer = await stripe.customers.list({ email: customerEmail }).then(res => res.data[0]);
        if (!customer) {
            customer = await stripe.customers.create({
                email: customerEmail,
            });
        }
        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent'],
        });
        return server_1.NextResponse.json({
            subscriptionId: subscription.id,
            clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
        });
    }
    catch (error) {
        console.error('Erreur lors de la création de l\'abonnement:', error);
        return server_1.NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
async function GET(req) {
    const url = new URL(req.url);
    const subscriptionId = url.searchParams.get('subscriptionId');
    if (!subscriptionId) {
        return server_1.NextResponse.json({ error: 'Subscription ID requis' }, { status: 400 });
    }
    const subscription = (await stripe.subscriptions.retrieve(subscriptionId));
    return server_1.NextResponse.json({
        status: subscription.status,
        current_period_end: subscription.current_period_end,
    });
}
//# sourceMappingURL=route.js.map