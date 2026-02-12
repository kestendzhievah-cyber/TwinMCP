"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = RootLayout;
const google_1 = require("next/font/google");
require("./globals.css");
const auth_context_1 = require("@/lib/auth-context");
const StripeProvider_1 = require("@/components/StripeProvider");
const inter = (0, google_1.Inter)({ subsets: ['latin'] });
exports.metadata = {
    title: 'Corel.IA - Plateforme SaaS pour Agents IA',
    description: 'Créez, gérez et optimisez des agents d\'intelligence artificielle personnalisés avec Corel.IA',
};
function RootLayout({ children, }) {
    return (<html lang="fr">
      <body className={inter.className}>
        <StripeProvider_1.StripeProvider>
          <auth_context_1.AuthProvider>
            {children}
          </auth_context_1.AuthProvider>
        </StripeProvider_1.StripeProvider>
      </body>
    </html>);
}
//# sourceMappingURL=layout.jsx.map