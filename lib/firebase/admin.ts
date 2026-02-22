import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { logger } from '@/lib/logger';

// Vérifier si les variables d'environnement nécessaires sont définies
const serviceAccount = {
  type: process.env['FIREBASE_ADMIN_TYPE'] || '',
  project_id: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] || '',
  private_key_id: process.env['FIREBASE_ADMIN_PRIVATE_KEY_ID'] || '',
  private_key: process.env['FIREBASE_ADMIN_PRIVATE_KEY']?.replace(/\\n/g, '\n') || '',
  client_email: process.env['FIREBASE_ADMIN_CLIENT_EMAIL'] || '',
  client_id: process.env['FIREBASE_ADMIN_CLIENT_ID'] || '',
  auth_uri: process.env['FIREBASE_ADMIN_AUTH_URI'] || '',
  token_uri: process.env['FIREBASE_ADMIN_TOKEN_URI'] || '',
  auth_provider_x509_cert_url: process.env['FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL'] || '',
  client_x509_cert_url: process.env['FIREBASE_ADMIN_CLIENT_CERT_URL'] || '',
  universe_domain: process.env['FIREBASE_ADMIN_UNIVERSE_DOMAIN'] || '',
};

// Vérifier si les informations d'identification sont présentes
const hasServiceAccount = (
  serviceAccount.private_key &&
  serviceAccount.client_email &&
  process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID']
);

let firebaseAdminApp: App | null = null;
let initializationError: Error | null = null;

// Fonction pour obtenir ou initialiser l'application Firebase Admin
export function getFirebaseAdminApp(): App | null {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  // During build time, return null gracefully instead of throwing
  if (!hasServiceAccount) {
    if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
      logger.error('Firebase Admin initialization error: Les informations d\'identification Firebase Admin sont manquantes');
      return null;
    }
    throw new Error('Les informations d\'identification Firebase Admin sont manquantes');
  }

  // Vérifier si une application a déjà été initialisée
  const [existingApp] = getApps();
  
  if (existingApp) {
    firebaseAdminApp = existingApp;
    return firebaseAdminApp;
  }

  // Initialiser une nouvelle application
  try {
    firebaseAdminApp = initializeApp({
      credential: cert(serviceAccount as any),
      databaseURL: `https://${process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID']}.firebaseio.com`,
    });
    
    logger.info('Firebase Admin initialisé avec succès');
    return firebaseAdminApp;
  } catch (error) {
    logger.error('Erreur lors de l\'initialisation de Firebase Admin:', error);
    // During build time, return null gracefully instead of throwing
    if (process.env.NODE_ENV === 'production') {
      initializationError = error as Error;
      return null;
    }
    throw error;
  }
}

// Initialiser Firestore
export function getFirebaseAdminDb() {
  const app = getFirebaseAdminApp();
  if (!app) {
    throw new Error('Firebase Admin non initialisé — vérifiez les variables d\'environnement FIREBASE_ADMIN_*');
  }
  return getFirestore(app);
}

// Initialiser Auth
export function getFirebaseAdminAuth() {
  const app = getFirebaseAdminApp();
  if (!app) {
    throw new Error('Firebase Admin non initialisé — vérifiez les variables d\'environnement FIREBASE_ADMIN_*');
  }
  return getAuth(app);
}

// Fonction utilitaire pour convertir un document Firestore en objet JavaScript
export function formatDocument(doc: any) {
  if (!doc.exists) return null;
  
  const data = doc.data();
  const formatted: any = { id: doc.id };
  
  // Convertir les Timestamp en Date
  Object.keys(data).forEach(key => {
    const value = data[key];
    
    if (value && typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
      formatted[key] = (value as any).toDate().toISOString();
    } else if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
      // Gestion des Timestamp Firebase v9
      formatted[key] = new Date(value.seconds * 1000 + value.nanoseconds / 1000000).toISOString();
    } else if (Array.isArray(value)) {
      // Traitement récursif des tableaux
      formatted[key] = value.map(item => 
        item && typeof item === 'object' && 'toDate' in item 
          ? (item as any).toDate().toISOString() 
          : item
      );
    } else if (value && typeof value === 'object') {
      // Traitement récursif des objets imbriqués
      formatted[key] = Object.entries(value).reduce((acc, [k, v]) => {
        if (v && typeof v === 'object' && 'toDate' in v && typeof (v as any).toDate === 'function') {
          acc[k] = (v as any).toDate().toISOString();
        } else {
          acc[k] = v;
        }
        return acc;
      }, {} as Record<string, any>);
    } else {
      formatted[key] = value;
    }
  });
  
  return formatted;
}
