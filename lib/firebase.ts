// Firebase configuration
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app'
import { getAuth, browserLocalPersistence, browserSessionPersistence, setPersistence, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env['NEXT_PUBLIC_FIREBASE_API_KEY'] || '',
  authDomain: process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'] || '',
  projectId: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] || '',
  storageBucket: process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'] || '',
  messagingSenderId: process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'] || '',
  appId: process.env['NEXT_PUBLIC_FIREBASE_APP_ID'] || '',
}

// Validate Firebase configuration
const isFirebaseConfigValid = () => {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);
  
  if (missingFields.length > 0) {
    console.warn('⚠️ Configuration Firebase incomplète. Champs manquants:', missingFields);
    return false;
  }
  
  // Check for placeholder values
  if (firebaseConfig.apiKey.includes('your-') || 
      firebaseConfig.messagingSenderId === '123456789012' ||
      firebaseConfig.appId.includes('abcdef')) {
    console.warn('⚠️ Configuration Firebase utilise des valeurs de placeholder');
    return false;
  }
  
  return true;
};

// Initialize Firebase - avoid multiple initializations
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let firebaseInitialized = false;

try {
  if (isFirebaseConfigValid()) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    firebaseInitialized = true;
    console.log('✅ Firebase initialisé avec succès');
  } else {
    console.warn('⚠️ Firebase non initialisé - configuration incomplète');
  }
} catch (error) {
  console.error('❌ Erreur lors de l\'initialisation de Firebase:', error);
  // Don't throw - allow app to continue without Firebase
}

// Persistence types for "Remember Me" functionality
export const AUTH_PERSISTENCE = {
  LOCAL: browserLocalPersistence,    // Persists even when browser window is closed
  SESSION: browserSessionPersistence // Cleared when browser window is closed
}

/**
 * Set authentication persistence based on "Remember Me" preference
 * @param rememberMe - If true, use local persistence; if false, use session persistence
 */
export async function setAuthPersistence(rememberMe: boolean): Promise<void> {
  if (!auth) {
    console.warn('Firebase auth not initialized');
    return;
  }
  
  try {
    const persistence = rememberMe ? AUTH_PERSISTENCE.LOCAL : AUTH_PERSISTENCE.SESSION
    await setPersistence(auth, persistence)
    console.log(`✅ Persistance définie: ${rememberMe ? 'LOCAL (Se souvenir de moi)' : 'SESSION'}`)
  } catch (error) {
    console.error('❌ Erreur lors de la définition de la persistance:', error)
  }
}

/**
 * Check if "Remember Me" was previously set
 */
export function getRememberMePreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem('twinmcp_remember_me') === 'true'
  } catch {
    return false
  }
}

/**
 * Save "Remember Me" preference
 */
export function saveRememberMePreference(rememberMe: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (rememberMe) {
      localStorage.setItem('twinmcp_remember_me', 'true')
    } else {
      localStorage.removeItem('twinmcp_remember_me')
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Clear "Remember Me" preference (on logout)
 */
export function clearRememberMePreference(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem('twinmcp_remember_me')
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Check if Firebase is properly initialized
 */
export function isFirebaseReady(): boolean {
  return firebaseInitialized && auth !== null;
}

// Export with null safety
export { app, auth, db, firebaseInitialized }
export default app
