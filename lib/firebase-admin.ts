// Firebase Admin configuration for server-side operations
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

// Export Firebase Admin services
export const auth = admin.auth();
export const db = admin.firestore();

// Default export for compatibility
export default {
  auth: auth,
  db: db
};
