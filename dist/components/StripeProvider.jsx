"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeProvider = StripeProvider;
const react_stripe_js_1 = require("@stripe/react-stripe-js");
const stripe_js_1 = require("@stripe/stripe-js");
// Load Stripe with your publishable key
const stripePromise = (0, stripe_js_1.loadStripe)(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
function StripeProvider({ children }) {
    return (<react_stripe_js_1.Elements stripe={stripePromise}>
      {children}
    </react_stripe_js_1.Elements>);
}
//# sourceMappingURL=StripeProvider.jsx.map