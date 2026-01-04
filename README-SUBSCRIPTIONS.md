# Système d'Abonnements avec Stripe - Corel.IA

Ce document explique comment utiliser le système d'abonnements Stripe implémenté dans l'application Corel.IA.

## 🎯 Vue d'ensemble

Le système d'abonnements complète le système de rôles existant en ajoutant une couche de monétisation :

- **Rôles** : Contrôlent les permissions (BUYER, SELLER, ADMIN)
- **Abonnements** : Contrôlent l'accès aux fonctionnalités premium (BASIC, PRO, PREMIUM, ENTERPRISE)

## 🚀 Configuration Stripe

### 1. Variables d'environnement

Ajoutez ces variables dans votre fichier `.env.local` :

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# URLs de l'application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Price IDs Stripe (à configurer après création des produits)
STRIPE_PRICE_BASIC_ID=price_basic_id
STRIPE_PRICE_PRO_ID=price_pro_id
STRIPE_PRICE_PREMIUM_ID=price_premium_id
STRIPE_PRICE_ENTERPRISE_ID=price_enterprise_id
```

### 2. Création des Produits Stripe

1. **Connectez-vous** à votre dashboard Stripe
2. **Créez des produits** pour chaque plan :
   - Basic (9.99€/mois)
   - Pro (29.99€/mois)
   - Premium (99.99€/mois)
   - Enterprise (299.99€/mois)
3. **Notez les Price IDs** et configurez-les dans les variables d'environnement

### 3. Configuration des Webhooks

1. **Ajoutez une URL de webhook** dans Stripe :
   ```
   https://votre-domaine.com/api/webhook
   ```
2. **Sélectionnez ces événements** :
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `checkout.session.completed`

## 🏗️ Structure de la Base de Données

### Modèle Subscription

```sql
model Subscription {
  id                String   @id @default(cuid())
  userId            String   @unique
  stripeCustomerId  String   @unique
  stripeSubscriptionId String @unique
  status            SubscriptionStatus @default(TRIAL)
  plan              SubscriptionPlan   @default(BASIC)
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])
}
```

### Enums

```sql
enum SubscriptionStatus {
  TRIAL
  ACTIVE
  PAST_DUE
  CANCELED
  UNPAID
  INCOMPLETE
  INCOMPLETE_EXPIRED
  PAUSED
}

enum SubscriptionPlan {
  BASIC
  PRO
  PREMIUM
  ENTERPRISE
}
```

## 💳 Limites par Plan

| Fonctionnalité | BASIC | PRO | PREMIUM | ENTERPRISE |
|----------------|-------|-----|---------|------------|
| Configurations MCP | 1 | 10 | 50 | ∞ |
| Produits | 5 | 50 | 200 | ∞ |
| Support | Basique | Prioritaire | Premium | Dédié |
| Analytics | ❌ | ✅ | ✅ | ✅ |
| API | ❌ | ❌ | ✅ | ✅ |

## 🔐 Middleware d'Abonnement

### Vérification d'abonnement actif

```typescript
import { requireActiveSubscription } from '@/lib/subscription-middleware';

// Dans une API route
export async function GET(request: NextRequest) {
  const subscriptionCheck = await requireActiveSubscription(request);
  if (subscriptionCheck) return subscriptionCheck; // 403 si pas d'abonnement

  // Code de la route...
}
```

### Vérification de plan

```typescript
import { requirePlan } from '@/lib/subscription-middleware';

// Plan PRO ou supérieur requis
export async function POST(request: NextRequest) {
  const planCheck = await requirePlan(request, 'PRO');
  if (planCheck) return planCheck; // 403 si plan insuffisant

  // Code de la route...
}
```

## 🎨 Interface Utilisateur

### Hook d'abonnement

```tsx
import { useSubscription } from '@/hooks/useSubscription';

function MyComponent() {
  const { subscription, isActive, plan, canCreateConfiguration } = useSubscription();

  if (!isActive) {
    return <SubscriptionBanner requiredPlan="PRO" />;
  }

  return (
    <div>
      <p>Plan actuel: {plan}</p>
      {canCreateConfiguration ? (
        <button>Créer une configuration</button>
      ) : (
        <SubscriptionBanner requiredPlan="PREMIUM" feature="plus de configurations" />
      )}
    </div>
  );
}
```

### Bannière d'abonnement

```tsx
import SubscriptionBanner from '@/components/SubscriptionBanner';

// Bannière contextuelle
<SubscriptionBanner
  requiredPlan="PRO"
  feature="cette fonctionnalité premium"
/>
```

## 📋 API Routes

### Gestion des abonnements

| Route | Méthode | Description | Authentification |
|-------|---------|-------------|------------------|
| `/api/subscription` | GET | Plans disponibles | Public |
| `/api/subscription` | POST | Créer un abonnement | Authentifié |
| `/api/subscription/user` | GET | Abonnement de l'utilisateur | Authentifié |
| `/api/subscription/session/[id]` | GET | Détails session Stripe | Public |

### Webhooks Stripe

| Route | Événement | Action |
|-------|-----------|--------|
| `/api/webhook` | `customer.subscription.*` | Sync DB |
| `/api/webhook` | `checkout.session.completed` | Lier customer |
| `/api/webhook` | `invoice.payment.*` | Log paiement |

## 💻 Pages Frontend

### 1. Catalogue des plans (`/subscription`)

- Affichage de tous les plans disponibles
- Interface de sélection avec Stripe Checkout
- Recommandation du plan PRO

### 2. Gestion d'abonnement (`/subscription/manage`)

- Détails de l'abonnement actuel
- Historique de facturation
- Options de upgrade/downgrade
- Annulation d'abonnement

### 3. Succès (`/subscription/success`)

- Confirmation d'abonnement
- Détails du plan activé
- Redirection vers les fonctionnalités

### 4. Annulation (`/subscription/cancel`)

- Message d'annulation
- Option de réessayer

## 🔄 Workflow Complet

### 1. Inscription
1. Utilisateur s'inscrit → Rôle `BUYER` par défaut
2. Pas d'abonnement → Plan `BASIC` (fonctionnalités limitées)

### 2. Abonnement
1. Utilisateur choisit un plan → Redirection Stripe Checkout
2. Paiement réussi → Webhook met à jour la DB
3. Abonnement actif → Accès aux fonctionnalités premium

### 3. Utilisation
1. Middleware vérifie l'abonnement avant chaque action
2. Interface s'adapte selon le plan
3. Limites appliquées (configurations, produits, etc.)

### 4. Renouvellement/Annulation
1. Stripe gère automatiquement le renouvellement
2. Webhooks synchronisent l'état en temps réel
3. Interface reflète les changements

## 🚨 Gestion des Erreurs

### Codes d'erreur API

```typescript
// 401 - Non authentifié
{ error: 'Authentification requise' }

// 403 - Abonnement requis
{
  error: 'Abonnement actif requis',
  subscription: { status: 'CANCELED', plan: 'BASIC' }
}

// 403 - Plan insuffisant
{
  error: 'Plan PRO ou supérieur requis',
  currentPlan: 'BASIC',
  requiredPlan: 'PRO'
}
```

### États d'abonnement

```typescript
switch (subscription.status) {
  case 'ACTIVE':
    // Accès complet
    break;
  case 'TRIAL':
    // Accès complet (période d'essai)
    break;
  case 'CANCELED':
    // Accès jusqu'à la fin de la période
    break;
  default:
    // Accès limité
}
```

## 🧪 Tests

### 1. Test d'abonnement

```bash
# 1. Créer un utilisateur de test
# 2. Aller sur /subscription
# 3. Choisir un plan
# 4. Compléter le paiement de test
# 5. Vérifier que l'abonnement est actif
# 6. Tester les limites du plan
```

### 2. Test des limites

```bash
# Vérifier que les utilisateurs BASIC ne peuvent pas :
# - Créer plus de 1 configuration
# - Créer plus de 5 produits
# - Accéder aux fonctionnalités premium
```

### 3. Test des webhooks

```bash
# Utiliser Stripe CLI pour tester les webhooks :
stripe listen --forward-to localhost:3000/api/webhook
stripe trigger customer.subscription.created
```

## 🔧 Maintenance

### 1. Synchronisation manuelle

Si les webhooks échouent, vous pouvez resynchroniser :

```bash
# Script de resynchronisation (à créer)
npm run sync-subscriptions
```

### 2. Logs et monitoring

- Surveillez les logs des webhooks
- Vérifiez la cohérence DB vs Stripe
- Monitorer les échecs de paiement

### 3. Migration des données

Si vous ajoutez le système d'abonnement à une app existante :

```sql
-- Créer des abonnements BASIC pour les utilisateurs existants
INSERT INTO subscriptions (userId, status, plan, ...)
SELECT id, 'TRIAL', 'BASIC', ...
FROM users;
```

## 📚 Ressources Supplémentaires

- [Documentation Stripe](https://stripe.com/docs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes)
- [Webhook Events](https://stripe.com/docs/api/events/types)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)

## 🚨 Points d'attention

1. **Sécurité** : Validez toujours côté serveur
2. **Cohérence** : Gardez DB et Stripe synchronisés
3. **Tests** : Testez tous les scénarios (upgrade, cancel, etc.)
4. **Monitoring** : Surveillez les webhooks et paiements
5. **Support** : Ayez un process pour les utilisateurs en difficulté

---

**Note** : Ce système est conçu pour être évolutif. Vous pouvez ajouter de nouveaux plans, fonctionnalités, ou modifier les limites selon vos besoins métier.
