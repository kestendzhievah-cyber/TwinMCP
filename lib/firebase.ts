// Firebase configuration
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, browserLocalPersistence, browserSessionPersistence, setPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

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
    console.error('❌ Configuration Firebase incomplète. Champs manquants:', missingFields);
    console.error('📖 Consultez FIREBASE_SETUP_GUIDE.md pour configurer Firebase correctement');
    return false;
  }
  
  // Check for placeholder values
  if (firebaseConfig.apiKey.includes('your-') || 
      firebaseConfig.messagingSenderId === '123456789012' ||
      firebaseConfig.appId.includes('abcdef')) {
    console.error('❌ Configuration Firebase utilise des valeurs de placeholder');
    console.error('📖 Consultez FIREBASE_SETUP_GUIDE.md pour obtenir vos vraies clés Firebase');
    return false;
  }
  
  return true;
};

// Initialize Firebase - avoid multiple initializations
let app;
try {
  if (!isFirebaseConfigValid()) {
    throw new Error('Configuration Firebase invalide. Consultez FIREBASE_SETUP_GUIDE.md');
  }
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  console.log('✅ Firebase initialisé avec succès');
} catch (error) {
  console.error('❌ Erreur lors de l\'initialisation de Firebase:', error);
  throw error;
}

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app)

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app)

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
  try {
    const persistence = rememberMe ? AUTH_PERSISTENCE.LOCAL : AUTH_PERSISTENCE.SESSION
    await setPersistence(auth, persistence)
    console.log(`✅ Persistance définie: ${rememberMe ? 'LOCAL (Se souvenir de moi)' : 'SESSION'}`)
  } catch (error) {
    console.error('❌ Erreur lors de la définition de la persistance:', error)
    throw error
  }
}

/**
 * Check if "Remember Me" was previously set
 */
export function getRememberMePreference(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('twinmcp_remember_me') === 'true'
}

/**
 * Save "Remember Me" preference
 */
export function saveRememberMePreference(rememberMe: boolean): void {
  if (typeof window === 'undefined') return
  if (rememberMe) {
    localStorage.setItem('twinmcp_remember_me', 'true')
  } else {
    localStorage.removeItem('twinmcp_remember_me')
  }
}

/**
 * Clear "Remember Me" preference (on logout)
 */
export function clearRememberMePreference(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('twinmcp_remember_me')
}

export default app
