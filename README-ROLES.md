# Système de Gestion des Rôles - Corel.IA

Ce document explique comment utiliser le système de gestion des rôles implémenté dans l'application Corel.IA.

## 🎯 Vue d'ensemble

Le système de rôles permet de contrôler l'accès aux fonctionnalités de l'application selon les permissions des utilisateurs :

- **BUYER** (Acheteur) : Utilisateur standard, peut naviguer et acheter
- **SELLER** (Vendeur) : Peut vendre des produits et gérer son inventaire
- **ADMIN** (Administrateur) : Accès complet à toutes les fonctionnalités

## 🚀 Configuration Initiale

### 1. Structure de la Base de Données

Le schéma Prisma est déjà configuré avec :
- Modèle `User` avec champ `role` (enum Role)
- Enum `Role` avec les valeurs : BUYER, SELLER, ADMIN

### 2. Premier Administrateur

Pour créer le premier administrateur, utilisez le script fourni :

```bash
# Via npm script
npm run promote-admin -- --email=admin@votre-domaine.com

# Ou directement avec node
node scripts/promote-admin.js --email=admin@votre-domaine.com
```

## 🔐 Authentification et Autorisation

### Middleware de Protection

Les routes sont protégées par des middlewares qui vérifient les rôles :

```typescript
// Exemple d'utilisation dans une API route
import { requireAdmin, requireSellerOrAdmin } from '@/lib/auth-middleware';

// Route admin uniquement
export async function GET(request: NextRequest) {
  const authCheck = await requireAdmin(request);
  if (authCheck) return authCheck; // Retourne 403 si pas admin

  // Code de la route...
}

// Route vendeur ou admin
export async function POST(request: NextRequest) {
  const authCheck = await requireSellerOrAdmin(request);
  if (authCheck) return authCheck; // Retourne 403 si pas vendeur/admin

  // Code de la route...
}
```

### Vérification Côté Frontend

Le contexte d'authentification récupère automatiquement le rôle :

```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user } = useAuth();

  // Vérifier le rôle
  if (user?.role === 'ADMIN') {
    return <AdminPanel />;
  }

  if (user?.role === 'SELLER') {
    return <SellerPanel />;
  }

  return <BuyerPanel />;
}
```

## 🛡️ Pages Admin Protégées

### 1. Configuration MCP (`/admin/mcp-configurations`)
- **Accès** : Administrateurs uniquement
- **Fonctionnalités** : Gestion des configurations MCP
- **Protection** : Vérification du rôle + middleware API

### 2. Gestion des Utilisateurs (`/admin/users`)
- **Accès** : Administrateurs uniquement
- **Fonctionnalités** :
  - Lister tous les utilisateurs
  - Modifier les rôles (BUYER ↔ SELLER ↔ ADMIN)
  - Promouvoir au rôle admin via bouton dédié
- **Protection** : Vérification du rôle + middleware API

## 🎨 Interface Utilisateur

### Navigation Conditionnelle

Le header affiche automatiquement les liens admin selon le rôle :

```tsx
{user?.role === 'ADMIN' && (
  <>
    <Link href="/admin/mcp-configurations">Config MCP</Link>
    <Link href="/admin/users">Utilisateurs</Link>
  </>
)}
```

### Badge de Rôle

Le rôle de l'utilisateur est affiché dans le header avec un badge coloré :
- 🔴 **Admin** : Badge rouge
- 🔵 **Vendeur** : Badge bleu
- ⚪ **Acheteur** : Badge gris

## 🔧 API Routes

### Routes Admin

| Route | Méthode | Description | Rôle requis |
|-------|---------|-------------|-------------|
| `/api/admin/users` | GET | Lister les utilisateurs | ADMIN |
| `/api/admin/users/[id]` | PUT | Modifier le rôle d'un utilisateur | ADMIN |
| `/api/admin/promote` | POST | Promouvoir un utilisateur admin | ADMIN |

### Routes Utilisateur

| Route | Méthode | Description | Rôle requis |
|-------|---------|-------------|-------------|
| `/api/user/sync` | POST | Synchroniser Firebase → DB | Authentifié |
| `/api/mcp-configurations` | GET/POST | Gestion configurations MCP | Authentifié |

## 📋 Workflow Complet

### 1. Inscription d'un Utilisateur
1. L'utilisateur s'inscrit via Firebase Auth
2. La route `/api/auth/signup` crée l'utilisateur dans Prisma avec le rôle `BUYER` par défaut
3. Le contexte AuthContext synchronise automatiquement les données

### 2. Promotion d'un Utilisateur
1. Un admin va sur `/admin/users`
2. Sélectionne le rôle `ADMIN` dans le dropdown ou clique sur "Admin"
3. L'API met à jour le rôle dans la base de données
4. L'utilisateur obtient immédiatement accès aux fonctionnalités admin

### 3. Vérification des Permissions
1. Middleware API vérifie le token et le rôle
2. Frontend vérifie le rôle dans le contexte
3. Interface s'adapte selon les permissions

## 🚨 Sécurité

### Points d'Attention

1. **Firebase Admin** : Configurer les credentials Firebase Admin en production
2. **Custom Claims** : Implémenter les Firebase Custom Claims pour optimiser la sécurité
3. **Rate Limiting** : Ajouter des limites sur les routes admin sensibles
4. **Audit Logs** : Logger les changements de rôles pour la traçabilité

### Recommandations

- ✅ Utiliser HTTPS en production
- ✅ Valider les rôles côté serveur ET côté client
- ✅ Implémenter une expiration des sessions
- ✅ Logger les actions admin pour l'audit
- ✅ Mettre en place une authentification à deux facteurs pour les admins

## 🧪 Tests

Pour tester le système :

1. **Créer un utilisateur normal**
   ```bash
   # Inscription via l'interface web
   # Rôle par défaut : BUYER
   ```

2. **Promouvoir en admin**
   ```bash
   npm run promote-admin -- --email=test@example.com
   ```

3. **Vérifier les permissions**
   - Vérifier que les liens admin n'apparaissent que pour les admins
   - Tester l'accès aux pages admin
   - Vérifier que les API retournent 403 pour les utilisateurs non autorisés

## 📚 Ressources Supplémentaires

- [Documentation Prisma](https://www.prisma.io/docs/)
- [Documentation Firebase Auth](https://firebase.google.com/docs/auth)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [TypeScript Enums](https://www.typescriptlang.org/docs/handbook/enums.html)

---

**Note** : Ce système est conçu pour être évolutif. Les rôles peuvent être étendus et les permissions affinées selon les besoins métier.
