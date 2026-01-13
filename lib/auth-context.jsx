"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAuth = useAuth;
exports.AuthProvider = AuthProvider;
const react_1 = require("react");
const auth_1 = require("firebase/auth");
const firebase_1 = require("./firebase");
const AuthContext = (0, react_1.createContext)(undefined);
function useAuth() {
    const context = (0, react_1.useContext)(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
function AuthProvider({ children }) {
    const [user, setUser] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        const unsubscribe = (0, auth_1.onAuthStateChanged)(firebase_1.auth, (user) => {
            setUser(user);
            setLoading(false);
        });
        return unsubscribe;
    }, []);
    const signIn = async (email, password) => {
        await (0, auth_1.signInWithEmailAndPassword)(firebase_1.auth, email, password);
    };
    const signUp = async (email, password) => {
        await (0, auth_1.createUserWithEmailAndPassword)(firebase_1.auth, email, password);
    };
    const signInWithGoogle = async () => {
        const provider = new auth_1.GoogleAuthProvider();
        await (0, auth_1.signInWithPopup)(firebase_1.auth, provider);
    };
    const logout = async () => {
        await (0, auth_1.signOut)(firebase_1.auth);
    };
    const value = {
        user,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        logout,
    };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
//# sourceMappingURL=auth-context.jsx.map