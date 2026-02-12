# Implémentation du système de facturation

## Vue d'ensemble

Ce document décrit l'implémentation complète du système de facturation basé sur le fichier `07-APIs-Externes.md`.

## Modifications effectuées

### 1. Correction des imports

**Fichiers modifiés :**
- `src/app/api/billing/invoices/route.ts`
- `src/app/api/billing/invoices/[id]/route.ts`
- `src/app/api/billing/payments/route.ts`

**Changements :** Utilisation des alias `@/services` et `@/types` au lieu des chemins relatifs.

### 2. Intégration des APIs de paiement externes

#### 2.1 Stripe Service (`src/services/payment-providers/stripe.service.ts`)

**Fonctionnalités :**
- Création de PaymentIntent
- Traitement des paiements
- Gestion des remboursements
- Création et gestion des clients
- Attachement de méthodes de paiement
- Vérification des webhooks

**Configuration requise :**
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### 2.2 PayPal Service (`src/services/payment-providers/paypal.service.ts`)

**Fonctionnalités :**
- Authentification OAuth2
- Création et capture d'ordres
- Traitement des paiements
- Gestion des remboursements
- Vérification des webhooks

**Configuration requise :**
```env
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_MODE=sandbox # ou 'live'
PAYPAL_WEBHOOK_ID=...
```

#### 2.3 Wise Service (`src/services/payment-providers/wise.service.ts`)

**Fonctionnalités :**
- Création de devis
- Création et financement de transferts
- Suivi des statuts de transfert
- Annulation de transferts

**Configuration requise :**
```env
WISE_API_KEY=...
WISE_PROFILE_ID=...
WISE_MODE=sandbox # ou 'live'
```

#### 2.4 Payment Provider Factory (`src/services/payment-providers/index.ts`)

Pattern Factory pour gérer tous les providers de paiement de manière unifiée.

### 3. Mise à jour du PaymentService

**Fichier :** `src/services/payment.service.ts`

**Modifications :**
- Intégration avec `PaymentProviderFactory`
- Méthode `updatePaymentStatus` rendue publique pour les webhooks
- Traitement des paiements via les providers externes
- Gestion des remboursements via les providers

### 4. Webhooks

#### 4.1 Stripe Webhook (`src/app/api/webhooks/stripe/route.ts`)

**Événements gérés :**
- `payment_intent.succeeded` - Paiement réussi
- `payment_intent.payment_failed` - Paiement échoué
- `charge.refunded` - Remboursement
- `customer.subscription.*` - Événements d'abonnement

**Endpoint :** `POST /api/webhooks/stripe`

#### 4.2 PayPal Webhook (`src/app/api/webhooks/paypal/route.ts`)

**Événements gérés :**
- `PAYMENT.CAPTURE.COMPLETED` - Paiement capturé
- `PAYMENT.CAPTURE.DENIED` - Paiement refusé
- `PAYMENT.CAPTURE.DECLINED` - Paiement décliné
- `PAYMENT.CAPTURE.REFUNDED` - Remboursement

**Endpoint :** `POST /api/webhooks/paypal`

### 5. Génération de PDF

**Fichier :** `src/app/api/billing/invoices/[id]/pdf/route.ts`

**Fonctionnalités :**
- Génération de PDF de facture
- Vérification des permissions utilisateur
- Audit des téléchargements
- Format A4 professionnel avec logo et informations complètes

**Endpoint :** `GET /api/billing/invoices/{id}/pdf?userId={userId}`

### 6. Service PDF existant

**Fichier :** `src/services/pdf.service.ts`

Le service PDF utilise Puppeteer pour générer des factures professionnelles avec :
- En-tête avec logo et statut
- Informations de l'entreprise
- Détails de la facture (numéro, dates)
- Informations client
- Période de facturation
- Tableau détaillé des items
- Calculs (sous-total, TVA, total)
- Pied de page avec informations de contact

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Routes                               │
├─────────────────────────────────────────────────────────────┤
│  /api/billing/invoices                                       │
│  /api/billing/invoices/[id]                                  │
│  /api/billing/invoices/[id]/pdf                              │
│  /api/billing/payments                                       │
│  /api/webhooks/stripe                                        │
│  /api/webhooks/paypal                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Services Layer                            │
├─────────────────────────────────────────────────────────────┤
│  InvoiceService                                              │
│  PaymentService ──────► PaymentProviderFactory              │
│  SubscriptionService                                         │
│  PDFService                                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Payment Providers                               │
├─────────────────────────────────────────────────────────────┤
│  StripeService    │  PayPalService    │  WiseService        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              External APIs                                   │
├─────────────────────────────────────────────────────────────┤
│  Stripe API       │  PayPal API       │  Wise API           │
└─────────────────────────────────────────────────────────────┘
```

## Flux de paiement

### 1. Création d'une facture
```
POST /api/billing/invoices
{
  "userId": "uuid",
  "period": {
    "type": "monthly",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  },
  "options": {
    "sendImmediately": true
  }
}
```

### 2. Traitement du paiement
```
POST /api/billing/payments
{
  "invoiceId": "uuid",
  "userId": "uuid",
  "amount": 99.99,
  "currency": "EUR",
  "provider": "stripe",
  "paymentMethodId": "pm_..."
}
```

### 3. Webhook de confirmation
```
Stripe/PayPal → POST /api/webhooks/{provider}
→ Mise à jour du statut de paiement
→ Mise à jour du statut de facture
→ Audit log
```

### 4. Téléchargement de la facture
```
GET /api/billing/invoices/{id}/pdf?userId={userId}
→ Génération du PDF
→ Téléchargement du fichier
```

## Sécurité

### Audit et logging
- Tous les accès aux factures sont enregistrés
- Les événements de sécurité sont tracés
- Les données sensibles sont masquées dans les logs

### Chiffrement
- Informations client chiffrées via `EncryptionService`
- Utilisation de `KeyManagementService` pour la gestion des clés
- Conformité GDPR via `GDPRService`

### Webhooks
- Vérification des signatures Stripe
- Vérification des signatures PayPal
- Logs de sécurité pour les tentatives invalides

## Dépendances à installer

```bash
npm install stripe axios
# ou
yarn add stripe axios
```

## Configuration des webhooks

### Stripe
1. Aller sur https://dashboard.stripe.com/webhooks
2. Créer un endpoint : `https://votre-domaine.com/api/webhooks/stripe`
3. Sélectionner les événements :
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `customer.subscription.*`
4. Copier le secret du webhook dans `STRIPE_WEBHOOK_SECRET`

### PayPal
1. Aller sur https://developer.paypal.com/dashboard/webhooks
2. Créer un webhook : `https://votre-domaine.com/api/webhooks/paypal`
3. Sélectionner les événements :
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.DECLINED`
   - `PAYMENT.CAPTURE.REFUNDED`
4. Copier l'ID du webhook dans `PAYPAL_WEBHOOK_ID`

## Tests

### Tester la création de facture
```bash
curl -X POST http://localhost:3000/api/billing/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "period": {
      "type": "monthly",
      "startDate": "2024-01-01",
      "endDate": "2024-01-31"
    }
  }'
```

### Tester le téléchargement PDF
```bash
curl http://localhost:3000/api/billing/invoices/{id}/pdf?userId={userId} \
  --output invoice.pdf
```

## Problèmes connus et solutions

### 1. Module 'axios' non trouvé
**Solution :** Installer axios avec `npm install axios`

### 2. Erreur TypeScript dans wise.service.ts
**Cause :** Appel à `response.json()` sans paramètre de type
**Solution :** Déjà corrigé avec `as T`

### 3. Buffer non compatible avec NextResponse
**Solution :** Cast avec `as unknown as BodyInit`

## Prochaines étapes recommandées

1. **Tests unitaires** : Ajouter des tests pour les services de paiement
2. **Tests d'intégration** : Tester les webhooks en environnement sandbox
3. **Monitoring** : Configurer des alertes pour les échecs de paiement
4. **Documentation API** : Créer une documentation OpenAPI/Swagger
5. **Rate limiting** : Ajouter des limites de taux pour les endpoints de paiement
6. **Retry logic** : Implémenter une logique de retry pour les paiements échoués
7. **Email notifications** : Envoyer des emails pour les factures et paiements

## Support

Pour toute question ou problème, consultez :
- Documentation Stripe : https://stripe.com/docs
- Documentation PayPal : https://developer.paypal.com/docs
- Documentation Wise : https://api-docs.wise.com
