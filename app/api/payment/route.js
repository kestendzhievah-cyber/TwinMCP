"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY);
async function POST(req) {
    try {
        const body = await req.json();
        const { amount, currency = 'eur', description } = body;
        if (!amount || amount <= 0) {
            return server_1.NextResponse.json({ error: 'Montant invalide' }, { status: 400 });
        }
        // Create a Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe uses cents
            currency,
            description,
            automatic_payment_methods: {
                enabled: true,
            },
        });
        return server_1.NextResponse.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        });
    }
    catch (error) {
        console.error('Erreur lors de la création du Payment Intent:', error);
        return server_1.NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
//# sourceMappingURL=route.js.map