"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AuthPage;
const react_1 = require("react");
const auth_1 = require("firebase/auth");
const firebase_1 = require("@/lib/firebase");
const navigation_1 = require("next/navigation");
function AuthPage() {
    const [isLogin, setIsLogin] = (0, react_1.useState)(true);
    const [email, setEmail] = (0, react_1.useState)('');
    const [password, setPassword] = (0, react_1.useState)('');
    const [name, setName] = (0, react_1.useState)('');
    const [error, setError] = (0, react_1.useState)('');
    const [loading, setLoading] = (0, react_1.useState)(false);
    const router = (0, navigation_1.useRouter)();
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isLogin) {
                await (0, auth_1.signInWithEmailAndPassword)(firebase_1.auth, email, password);
            }
            else {
                await (0, auth_1.createUserWithEmailAndPassword)(firebase_1.auth, email, password);
            }
            router.push('/');
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    };
    const handleSignOut = async () => {
        await (0, auth_1.signOut)(firebase_1.auth);
        router.push('/');
    };
    return (<div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isLogin ? 'Se connecter' : 'Créer un compte'}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <input type="hidden" name="remember" defaultValue="true"/>
          <div className="rounded-md shadow-sm -space-y-px">
            {!isLogin && (<div>
                <label htmlFor="name" className="sr-only">
                  Nom
                </label>
                <input id="name" name="name" type="text" required={!isLogin} className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)}/>
              </div>)}
            <div>
              <label htmlFor="email-address" className="sr-only">
                Adresse e-mail
              </label>
              <input id="email-address" name="email" type="email" autoComplete="email" required className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 ${!isLogin ? 'rounded-none' : 'rounded-t-md'} focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`} placeholder="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)}/>
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Mot de passe
              </label>
              <input id="password" name="password" type="password" autoComplete="current-password" required className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)}/>
            </div>
          </div>

          {error && (<div className="text-red-600 text-sm text-center">{error}</div>)}

          <div>
            <button type="submit" disabled={loading} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
              {loading ? 'Chargement...' : isLogin ? 'Se connecter' : 'Créer un compte'}
            </button>
          </div>

          <div className="text-center">
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-blue-600 hover:text-blue-500">
              {isLogin ? "Pas de compte ? Créer un" : 'Déjà un compte ? Se connecter'}
            </button>
          </div>
        </form>
      </div>
    </div>);
}
//# sourceMappingURL=page.jsx.map