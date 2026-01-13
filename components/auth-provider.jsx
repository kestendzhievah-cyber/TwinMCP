"use strict";
"use client";
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
exports.AuthProvider = AuthProvider;
exports.useAuth = useAuth;
const react_1 = __importStar(require("react"));
const api_client_1 = require("@/lib/client/api-client");
const AuthContext = (0, react_1.createContext)(undefined);
function AuthProvider({ children }) {
    const [user, setUser] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        // Vérifier si un utilisateur est déjà connecté au chargement
        const savedUser = localStorage.getItem('twinmcp_user');
        if (savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                setUser(parsedUser);
                api_client_1.apiClient.setApiKey(parsedUser.apiKey || '');
            }
            catch (error) {
                console.error('Error parsing saved user:', error);
                localStorage.removeItem('twinmcp_user');
            }
        }
    }, []);
    const login = async (email, password) => {
        setLoading(true);
        try {
            // Simulation d'authentification (à remplacer par un vrai appel API)
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Simulation de validation
            if (email === 'admin@twinmcp.com' && password === 'admin123') {
                const userData = {
                    id: '1',
                    email: 'admin@twinmcp.com',
                    name: 'TwinMCP Admin',
                    apiKey: 'twinmcp_live_test123' // Clé de test
                };
                setUser(userData);
                localStorage.setItem('twinmcp_user', JSON.stringify(userData));
                api_client_1.apiClient.setApiKey(userData.apiKey);
                return true;
            }
            else {
                return false;
            }
        }
        catch (error) {
            console.error('Login error:', error);
            return false;
        }
        finally {
            setLoading(false);
        }
    };
    const logout = () => {
        setUser(null);
        localStorage.removeItem('twinmcp_user');
        api_client_1.apiClient.clearApiKey();
    };
    const setApiKey = (apiKey) => {
        if (user) {
            const updatedUser = { ...user, apiKey };
            setUser(updatedUser);
            localStorage.setItem('twinmcp_user', JSON.stringify(updatedUser));
            api_client_1.apiClient.setApiKey(apiKey);
        }
    };
    const value = {
        user,
        login,
        logout,
        loading,
        setApiKey
    };
    return (<AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>);
}
function useAuth() {
    const context = (0, react_1.useContext)(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
//# sourceMappingURL=auth-provider.jsx.map