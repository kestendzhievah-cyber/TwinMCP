"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ProtectedRoute;
exports.AuthenticatedContent = AuthenticatedContent;
exports.UnauthenticatedContent = UnauthenticatedContent;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const auth_context_1 = require("@/lib/auth-context");
function ProtectedRoute({ children, redirectTo = '/login' }) {
    const { user, loading } = (0, auth_context_1.useAuth)();
    const router = (0, navigation_1.useRouter)();
    (0, react_1.useEffect)(() => {
        if (!loading && !user) {
            router.push(redirectTo);
        }
    }, [user, loading, router, redirectTo]);
    // Afficher un loader stylé pendant la vérification de l'authentification
    if (loading) {
        return (<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Vérification de l'authentification...</p>
        </div>
      </div>);
    }
    // Rediriger si l'utilisateur n'est pas connecté
    if (!user) {
        return null;
    }
    // Rendre le contenu protégé si l'utilisateur est connecté
    return <>{children}</>;
}
// Composant optionnel pour afficher du contenu uniquement aux utilisateurs connectés
function AuthenticatedContent({ children }) {
    const { user } = (0, auth_context_1.useAuth)();
    if (!user) {
        return null;
    }
    return <>{children}</>;
}
// Composant pour afficher du contenu uniquement aux utilisateurs non connectés
function UnauthenticatedContent({ children }) {
    const { user } = (0, auth_context_1.useAuth)();
    if (user) {
        return null;
    }
    return <>{children}</>;
}
//# sourceMappingURL=protected-route.jsx.map