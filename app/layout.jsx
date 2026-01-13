"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = RootLayout;
const google_1 = require("next/font/google");
const script_1 = __importDefault(require("next/script"));
const next_1 = require("@vercel/speed-insights/next");
require("./globals.css");
const auth_context_1 = require("../lib/auth-context");
const StripeProvider_1 = require("../components/StripeProvider");
const inter = (0, google_1.Inter)({ subsets: ['latin'] });
exports.metadata = {
    title: 'AgentFlow - Plateforme SaaS pour Agents IA',
    description: 'Créez, gérez et optimisez des agents d\'intelligence artificielle personnalisés avec AgentFlow',
};
function RootLayout({ children, }) {
    return (<html lang="fr">
      <head>
        <script_1.default src="https://www.google.com/recaptcha/enterprise.js?render=6LenTfIrAAAAANlD2F8YQawKA2-PtM8iDjpM2MH4" strategy="beforeInteractive"/>
        <script_1.default id="recaptcha-callback" strategy="afterInteractive">
          {`
            window.recaptchaToken = '';

            function onRecaptchaSubmit(token) {
              window.recaptchaToken = token;
              // Inject the token into the hidden input so client code can read it.
              const tokenInput = document.getElementById('recaptcha-token');
              if (tokenInput) {
                tokenInput.value = token;
              }
              // Do NOT programmatically submit the form here. The client's onSubmit
              // handler is responsible for reading the token and performing the
              // fetch/navigation flow to avoid full page reloads.
            }
          `}
        </script_1.default>
      </head>
      <body className={inter.className}>
        <StripeProvider_1.StripeProvider>
          <auth_context_1.AuthProvider>
            {children}
          </auth_context_1.AuthProvider>
        </StripeProvider_1.StripeProvider>
        <next_1.SpeedInsights />
      </body>
    </html>);
}
//# sourceMappingURL=layout.jsx.map