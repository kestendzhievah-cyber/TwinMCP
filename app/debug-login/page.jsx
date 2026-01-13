"use strict";
// app/debug-login/page.tsx
'use client';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DebugLoginPage;
const react_1 = __importStar(require("react"));
const auth_1 = require("firebase/auth");
const firebase_1 = require("../../lib/firebase");
function DebugLoginPage() {
    const [email, setEmail] = (0, react_1.useState)('');
    const [password, setPassword] = (0, react_1.useState)('');
    const [error, setError] = (0, react_1.useState)('');
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [debugInfo, setDebugInfo] = (0, react_1.useState)('');
    // Debug Firebase
    (0, react_1.useEffect)(() => {
        console.log('🔍 Debug Firebase:');
        console.log('auth exists:', !!firebase_1.auth);
        console.log('auth config:', firebase_1.auth?.config);
        if (!firebase_1.auth) {
            setDebugInfo('❌ Firebase Auth non initialisé');
        }
        else if (!firebase_1.auth.config?.apiKey) {
            setDebugInfo('❌ Config Firebase invalide');
        }
        else {
            setDebugInfo('✅ Firebase OK');
        }
    }, []);
    const handleGoogleLogin = async () => {
        console.log('🔐 Tentative Google...');
        setError('');
        setLoading(true);
        try {
            const googleProvider = new auth_1.GoogleAuthProvider();
            const result = await (0, auth_1.signInWithPopup)(firebase_1.auth, googleProvider);
            console.log('✅ Google OK:', result.user);
            window.location.href = '/dashboard';
        }
        catch (err) {
            console.error('❌ Erreur Google:', err);
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    };
    const handleEmailLogin = async () => {
        console.log('🔐 Tentative de connexion...');
        setError('');
        setLoading(true);
        try {
            console.log('📧 Email:', email);
            const result = await (0, auth_1.signInWithEmailAndPassword)(firebase_1.auth, email, password);
            console.log('✅ Connexion réussie:', result.user);
            window.location.href = '/dashboard';
        }
        catch (err) {
            console.error('❌ Erreur:', err);
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    };
    return (<div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-6">Connexion (Debug)</h1>

        {/* Debug Info */}
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500 rounded text-sm text-blue-300">
          {debugInfo}
        </div>

        {/* Error */}
        {error && (<div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded text-sm text-red-300">
            {error}
          </div>)}

        {/* Google Button */}
        <button onClick={handleGoogleLogin} disabled={loading} className="w-full mb-4 py-3 bg-white text-gray-900 font-semibold rounded hover:bg-gray-100 disabled:opacity-50">
          {loading ? 'Chargement...' : 'Google Login'}
        </button>

        {/* Email/Password */}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full mb-3 px-4 py-3 bg-gray-700 text-white rounded"/>

        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full mb-4 px-4 py-3 bg-gray-700 text-white rounded"/>

        <button onClick={handleEmailLogin} disabled={loading} className="w-full py-3 bg-purple-600 text-white font-semibold rounded hover:bg-purple-700 disabled:opacity-50">
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>

        {/* Console Logs */}
        <div className="mt-4 text-xs text-gray-500">
          Ouvrez la console (F12) pour voir les logs détaillés
        </div>
      </div>
    </div>);
}
//# sourceMappingURL=page.jsx.map