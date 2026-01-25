# Guide de Configuration Firebase pour TwinMCP

## Problème actuel
La connexion Google ne fonctionne pas car les clés Firebase dans `.env.local` et `.env.production` sont des valeurs de placeholder et non vos vraies clés Firebase.

## Solution : Configurer Firebase correctement

### Étape 1 : Créer/Accéder à votre projet Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet existant `studio-3830496577-209fb` ou créez-en un nouveau
3. Cliquez sur l'icône d'engrenage ⚙️ > **Paramètres du projet**

### Étape 2 : Obtenir les clés de configuration

1. Dans **Paramètres du projet**, descendez jusqu'à la section **Vos applications**
2. Si vous n'avez pas encore d'application web, cliquez sur **</>** (icône web) pour en ajouter une
3. Copiez la configuration Firebase qui ressemble à :

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "votre-projet.firebaseapp.com",
  projectId: "votre-projet",
  storageBucket: "votre-projet.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
  measurementId: "G-ABC123"
};
```

### Étape 3 : Activer l'authentification Google

1. Dans la console Firebase, allez dans **Authentication** (menu de gauche)
2. Cliquez sur l'onglet **Sign-in method**
3. Trouvez **Google** dans la liste des fournisseurs
4. Cliquez sur **Google** puis sur **Activer**
5. Renseignez un email de support public
6. Cliquez sur **Enregistrer**

### Étape 4 : Configurer les domaines autorisés

1. Toujours dans **Authentication** > **Settings** (onglet)
2. Descendez jusqu'à **Authorized domains**
3. Ajoutez vos domaines :
   - `localhost` (pour le développement)
   - Votre domaine de production (ex: `twinmcp.com`)

### Étape 5 : Mettre à jour vos fichiers .env

Remplacez les valeurs dans `.env.local` avec vos vraies clés Firebase :

```env
# Configuration Firebase (REMPLACER PAR VOS VRAIES VALEURS)
NEXT_PUBLIC_FIREBASE_API_KEY=votre_vraie_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=votre-projet.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=votre-projet-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=votre-projet.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=votre_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=votre_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=votre_measurement_id
```

Faites de même pour `.env.production`.

### Étape 6 : Redémarrer le serveur de développement

```bash
# Arrêtez le serveur actuel (Ctrl+C)
# Puis relancez
npm run dev
```

## Vérification

Une fois configuré correctement :
1. Allez sur la page de login
2. Cliquez sur "Continuer avec Google"
3. Une popup Google devrait s'ouvrir
4. Sélectionnez votre compte Google
5. Vous devriez être redirigé vers le dashboard

## Erreurs courantes

### "Popup blocked by browser"
- Autorisez les popups pour localhost dans votre navigateur

### "auth/unauthorized-domain"
- Vérifiez que votre domaine est dans les "Authorized domains" de Firebase

### "auth/invalid-api-key"
- Vérifiez que vous avez copié la bonne API key depuis Firebase Console

### "auth/configuration-not-found"
- Vérifiez que l'authentification Google est bien activée dans Firebase Console

## Support

Si le problème persiste après avoir suivi ce guide :
1. Vérifiez la console du navigateur (F12) pour voir les erreurs exactes
2. Vérifiez que toutes les variables d'environnement sont bien définies
3. Assurez-vous d'avoir redémarré le serveur après modification des .env
