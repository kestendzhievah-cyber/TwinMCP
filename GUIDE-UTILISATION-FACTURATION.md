# Guide d'Utilisation - Système de Facturation TwinMCP

**Version:** 1.0  
**Date:** 18 janvier 2026

## 📚 Table des Matières

1. [Introduction](#introduction)
2. [Configuration Initiale](#configuration-initiale)
3. [Utilisation des APIs](#utilisation-des-apis)
4. [Utilisation des Composants UI](#utilisation-des-composants-ui)
5. [Gestion des Webhooks](#gestion-des-webhooks)
6. [Exemples Pratiques](#exemples-pratiques)
7. [Dépannage](#dépannage)

## Introduction

Le système de facturation TwinMCP offre une solution complète pour:
- Générer des factures automatiquement basées sur l'utilisation
- Traiter des paiements via Stripe, PayPal ou Wise
- Gérer des abonnements et crédits
- Générer des PDFs professionnels
- Assurer la conformité RGPD et la sécurité des données

## Configuration Initiale

### 1. Variables d'Environnement

Créez un fichier `.env.local` avec les configurations suivantes:

```env
# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/twinmcp"
DIRECT_DATABASE_URL="postgresql://user:password@localhost:5432/twinmcp"

# Stripe
STRIPE_SECRET_KEY="sk_test_votre_cle_secrete"
STRIPE_WEBHOOK_SECRET="whsec_votre_webhook_secret"

# PayPal
PAYPAL_CLIENT_ID="votre_client_id"
PAYPAL_CLIENT_SECRET="votre_client_secret"
PAYPAL_MODE="sandbox"  # ou "live" en production
PAYPAL_WEBHOOK_ID="votre_webhook_id"

# Wise (optionnel)
WISE_API_KEY="votre_api_key"
WISE_PROFILE_ID="votre_profile_id"
WISE_MODE="sandbox"  # ou "live" en production

# Configuration des factures
INVOICE_TAX_RATE="0.2"  # TVA 20%
INVOICE_DUE_DAYS="30"   # Échéance à 30 jours
INVOICE_CURRENCY="EUR"

# Configuration Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="votre_email@gmail.com"
SMTP_PASS="votre_mot_de_passe"
SMTP_FROM="noreply@votredomaine.com"
INVOICE_EMAIL_FROM="facturation@votredomaine.com"
```

### 2. Installation des Dépendances

```bash
npm install stripe axios nodemailer puppeteer
```

### 3. Migration de la Base de Données

```bash
npx prisma generate
npx prisma migrate deploy
```

### 4. Configuration des Webhooks

#### Stripe

1. Accédez à https://dashboard.stripe.com/webhooks
2. Cliquez sur "Add endpoint"
3. URL: `https://votredomaine.com/api/webhooks/stripe`
4. Sélectionnez les événements:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copiez le "Signing secret" dans `STRIPE_WEBHOOK_SECRET`

#### PayPal

1. Accédez à https://developer.paypal.com/dashboard/webhooks
2. Créez un nouveau webhook
3. URL: `https://votredomaine.com/api/webhooks/paypal`
4. Sélectionnez les événements:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.DECLINED`
   - `PAYMENT.CAPTURE.REFUNDED`
5. Copiez le "Webhook ID" dans `PAYPAL_WEBHOOK_ID`

## Utilisation des APIs

### Créer une Facture

**Endpoint:** `POST /api/billing/invoices`

```javascript
const response = await fetch('/api/billing/invoices', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userId: 'user_123',
    period: {
      type: 'monthly',
      startDate: '2024-01-01',
      endDate: '2024-01-31'
    },
    options: {
      sendImmediately: true,  // Envoyer par email immédiatement
      forceRegenerate: false  // Forcer la régénération si existe
    }
  })
});

const data = await response.json();
console.log('Facture créée:', data.data.invoice);
```

### Récupérer les Factures d'un Utilisateur

**Endpoint:** `GET /api/billing/invoices?userId={userId}&status={status}`

```javascript
const response = await fetch('/api/billing/invoices?userId=user_123&status=PAID');
const data = await response.json();
console.log('Factures:', data.data.invoices);
```

### Récupérer une Facture Spécifique

**Endpoint:** `GET /api/billing/invoices/{id}?userId={userId}`

```javascript
const response = await fetch('/api/billing/invoices/inv_123?userId=user_123');
const data = await response.json();
console.log('Facture:', data.data.invoice);
```

### Mettre à Jour le Statut d'une Facture

**Endpoint:** `PUT /api/billing/invoices/{id}`

```javascript
const response = await fetch('/api/billing/invoices/inv_123', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    status: 'PAID',
    metadata: {
      paidVia: 'stripe',
      paidAt: new Date().toISOString()
    }
  })
});
```

### Télécharger une Facture en PDF

**Endpoint:** `GET /api/billing/invoices/{id}/pdf?userId={userId}`

```javascript
const response = await fetch('/api/billing/invoices/inv_123/pdf?userId=user_123');
const blob = await response.blob();

// Télécharger le fichier
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'facture.pdf';
a.click();
```

### Créer un Paiement

**Endpoint:** `POST /api/billing/payments`

```javascript
const response = await fetch('/api/billing/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    invoiceId: 'inv_123',
    userId: 'user_123',
    amount: 99.99,
    currency: 'EUR',
    provider: 'stripe',  // 'stripe', 'paypal', ou 'wise'
    paymentMethod: {
      id: 'pm_123',
      userId: 'user_123',
      type: 'card',
      provider: 'stripe',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  })
});

const data = await response.json();
console.log('Paiement créé:', data.data.payment);
```

### Récupérer les Paiements d'un Utilisateur

**Endpoint:** `GET /api/billing/payments?userId={userId}&limit={limit}&offset={offset}`

```javascript
const response = await fetch('/api/billing/payments?userId=user_123&limit=10&offset=0');
const data = await response.json();
console.log('Paiements:', data.data.payments);
```

## Utilisation des Composants UI

### InvoiceList

Affiche la liste des factures avec filtrage et téléchargement PDF.

```tsx
import { InvoiceList } from '@/components/InvoiceList';

function BillingPage() {
  const handleViewInvoice = (invoice) => {
    console.log('Voir facture:', invoice);
    // Naviguer vers la page de détail
  };

  return (
    <div className="container mx-auto p-6">
      <InvoiceList 
        userId="user_123"
        onViewInvoice={handleViewInvoice}
      />
    </div>
  );
}
```

### InvoiceDetail

Affiche les détails complets d'une facture.

```tsx
import { InvoiceDetail } from '@/components/InvoiceDetail';

function InvoiceDetailPage({ invoice }) {
  const handleDownloadPDF = async () => {
    const response = await fetch(`/api/billing/invoices/${invoice.id}/pdf?userId=${invoice.userId}`);
    const blob = await response.blob();
    // Télécharger le PDF
  };

  return (
    <InvoiceDetail 
      invoice={invoice}
      onDownloadPDF={handleDownloadPDF}
      onClose={() => window.history.back()}
    />
  );
}
```

### PaymentForm

Formulaire de paiement pour une facture.

```tsx
import { PaymentForm } from '@/components/PaymentForm';

function PaymentPage({ invoice }) {
  const handleSuccess = () => {
    alert('Paiement réussi!');
    // Rediriger vers la page de confirmation
  };

  const handleCancel = () => {
    window.history.back();
  };

  return (
    <PaymentForm 
      invoice={invoice}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
}
```

## Gestion des Webhooks

### Stripe Webhook

Le webhook Stripe gère automatiquement:
- Confirmation de paiement réussi
- Notification d'échec de paiement
- Remboursements
- Événements d'abonnement

**Aucune action requise** - Le système met à jour automatiquement les statuts.

### PayPal Webhook

Le webhook PayPal gère automatiquement:
- Capture de paiement complétée
- Paiement refusé ou décliné
- Remboursements

**Aucune action requise** - Le système met à jour automatiquement les statuts.

## Exemples Pratiques

### Exemple 1: Flux Complet de Facturation

```typescript
// 1. Créer une facture
const invoice = await fetch('/api/billing/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_123',
    period: {
      type: 'monthly',
      startDate: '2024-01-01',
      endDate: '2024-01-31'
    }
  })
}).then(r => r.json());

// 2. Créer un paiement
const payment = await fetch('/api/billing/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    invoiceId: invoice.data.invoice.id,
    userId: 'user_123',
    amount: invoice.data.invoice.total,
    currency: invoice.data.invoice.currency,
    provider: 'stripe',
    paymentMethod: { /* ... */ }
  })
}).then(r => r.json());

// 3. Le webhook Stripe confirmera automatiquement le paiement
// 4. Le statut de la facture sera mis à jour automatiquement
```

### Exemple 2: Générer et Envoyer une Facture

```typescript
const invoice = await fetch('/api/billing/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_123',
    period: {
      type: 'monthly',
      startDate: '2024-01-01',
      endDate: '2024-01-31'
    },
    options: {
      sendImmediately: true  // Envoie automatiquement par email
    }
  })
}).then(r => r.json());

console.log('Facture envoyée à:', invoice.data.invoice.billingAddress.email);
```

### Exemple 3: Télécharger Toutes les Factures d'un Utilisateur

```typescript
const response = await fetch('/api/billing/invoices?userId=user_123');
const { data } = await response.json();

for (const invoice of data.invoices) {
  const pdfResponse = await fetch(`/api/billing/invoices/${invoice.id}/pdf?userId=user_123`);
  const blob = await pdfResponse.blob();
  
  // Sauvegarder le PDF
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `facture-${invoice.number}.pdf`;
  a.click();
}
```

## Dépannage

### Problème: Facture non générée

**Symptôme:** Erreur "Invoice already exists for period"

**Solution:**
```typescript
// Utiliser l'option forceRegenerate
const invoice = await fetch('/api/billing/invoices', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'user_123',
    period: { /* ... */ },
    options: {
      forceRegenerate: true  // Force la régénération
    }
  })
});
```

### Problème: Email non envoyé

**Symptôme:** Facture créée mais email non reçu

**Vérifications:**
1. Vérifiez les variables SMTP dans `.env.local`
2. Vérifiez les logs: `console.warn('SMTP configuration missing')`
3. Testez la configuration SMTP:

```bash
# Test SMTP avec Node.js
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
transporter.verify().then(console.log).catch(console.error);
"
```

### Problème: Webhook non reçu

**Symptôme:** Paiement effectué mais statut non mis à jour

**Vérifications:**
1. Vérifiez que l'URL du webhook est accessible publiquement
2. Vérifiez les logs du webhook dans le dashboard Stripe/PayPal
3. Testez le webhook localement avec ngrok:

```bash
# Installer ngrok
npm install -g ngrok

# Exposer le port local
ngrok http 3000

# Utiliser l'URL ngrok dans la configuration du webhook
```

### Problème: PDF non généré

**Symptôme:** Erreur lors de la génération du PDF

**Solution:**
```bash
# Installer les dépendances Puppeteer
npm install puppeteer

# Sur Linux, installer les dépendances système
sudo apt-get install -y chromium-browser
```

### Problème: Erreur de chiffrement

**Symptôme:** "Failed to decrypt customer info"

**Solution:**
Vérifiez que le KeyManagementService est correctement configuré et que les clés de chiffrement sont cohérentes entre les environnements.

## Support

Pour toute question ou problème:
- Consultez la documentation complète: `IMPLEMENTATION-FACTURATION-COMPLETE.md`
- Vérifiez les tests: `TESTS-FACTURATION-IMPLEMENTATION.md`
- Contactez l'équipe de support

---

**Document généré le:** 18 janvier 2026  
**Version:** 1.0  
**Projet:** TwinMCP - Guide d'Utilisation Facturation
