"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirebaseAdminApp = getFirebaseAdminApp;
exports.getFirebaseAdminDb = getFirebaseAdminDb;
exports.getFirebaseAdminAuth = getFirebaseAdminAuth;
exports.formatDocument = formatDocument;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
// Vérifier si les variables d'environnement nécessaires sont définies
const serviceAccount = {
    type: process.env.FIREBASE_ADMIN_TYPE,
    project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
    auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI,
    token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_CERT_URL,
    universe_domain: process.env.FIREBASE_ADMIN_UNIVERSE_DOMAIN,
};
// Vérifier si les informations d'identification sont présentes
const hasServiceAccount = (serviceAccount.private_key &&
    serviceAccount.client_email &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
let firebaseAdminApp = null;
// Fonction pour obtenir ou initialiser l'application Firebase Admin
function getFirebaseAdminApp() {
    if (firebaseAdminApp) {
        return firebaseAdminApp;
    }
    if (!hasServiceAccount) {
        throw new Error('Les informations d\'identification Firebase Admin sont manquantes');
    }
    // Vérifier si une application a déjà été initialisée
    const [existingApp] = (0, app_1.getApps)();
    if (existingApp) {
        firebaseAdminApp = existingApp;
        return firebaseAdminApp;
    }
    // Initialiser une nouvelle application
    try {
        firebaseAdminApp = (0, app_1.initializeApp)({
            credential: (0, app_1.cert)(serviceAccount),
            databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
        });
        console.log('Firebase Admin initialisé avec succès');
        return firebaseAdminApp;
    }
    catch (error) {
        console.error('Erreur lors de l\'initialisation de Firebase Admin:', error);
        throw error;
    }
}
// Initialiser Firestore
function getFirebaseAdminDb() {
    const app = getFirebaseAdminApp();
    return (0, firestore_1.getFirestore)(app);
}
// Initialiser Auth
function getFirebaseAdminAuth() {
    const app = getFirebaseAdminApp();
    return (0, auth_1.getAuth)(app);
}
// Fonction utilitaire pour convertir un document Firestore en objet JavaScript
function formatDocument(doc) {
    if (!doc.exists)
        return null;
    const data = doc.data();
    const formatted = { id: doc.id };
    // Convertir les Timestamp en Date
    Object.keys(data).forEach(key => {
        const value = data[key];
        if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
            formatted[key] = value.toDate().toISOString();
        }
        else if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
            // Gestion des Timestamp Firebase v9
            formatted[key] = new Date(value.seconds * 1000 + value.nanoseconds / 1000000).toISOString();
        }
        else if (Array.isArray(value)) {
            // Traitement récursif des tableaux
            formatted[key] = value.map(item => item && typeof item === 'object' && 'toDate' in item
                ? item.toDate().toISOString()
                : item);
        }
        else if (value && typeof value === 'object') {
            // Traitement récursif des objets imbriqués
            formatted[key] = Object.entries(value).reduce((acc, [k, v]) => {
                if (v && typeof v === 'object' && 'toDate' in v && typeof v.toDate === 'function') {
                    acc[k] = v.toDate().toISOString();
                }
                else {
                    acc[k] = v;
                }
                return acc;
            }, {});
        }
        else {
            formatted[key] = value;
        }
    });
    return formatted;
}
//# sourceMappingURL=admin.js.map