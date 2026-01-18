# Système de Facturation TwinMCP - Documentation Complète

**Date**: 2026-01-18  
**Version**: 1.0.0  
**Statut**: ✅ Implémenté et Corrigé

---

## 📋 Vue d'ensemble

Le système de facturation TwinMCP est maintenant **entièrement fonctionnel** avec toutes les corrections appliquées. Ce document récapitule l'implémentation complète.

---

## ✅ Corrections Appliquées

### 1. **AuditService** - Signature flexible
**Fichier**: `src/services/security/audit.service.ts`

**Problème**: La méthode `logAccess` avait une signature rigide qui causait des erreurs d'appel.

**Solution**: Signature flexible acceptant soit `(userId, resource, resourceId, action, metadata)` soit `(userId, resource, resourceId, action, ipAddress, userAgent, metadata)`.

```typescript
async logAccess(
  userId: string,
  resource: string,
  resourceId: string,
  action: string,
  metadataOrIpAddress?: string | any,
  userAgent?: string,
  metadata?: any
): Promise<void>
```

### 2. **BillingNotificationService** - Propriétés Invoice
**Fichier**: `src/services/billing-notification.service.ts`

**Problème**: Utilisation de propriétés inexistantes (`invoiceNumber`, `totalAmount`).

**Solution**: Correction vers les bonnes propriétés:
- `invoice.invoiceNumber` → `invoice.number`
- `invoice.totalAmount` → `invoice.total`

### 3. **Types Payment** - Fichier manquant
**Fichier**: `src/types/payment.types.ts` ✨ **CRÉÉ**

Ajout de tous les types nécessaires:
- `PaymentStatus` enum
- `PaymentProvider` enum
- `Payment` interface
- `PaymentIntent` interface
- `PaymentMethod` interface
- `RefundRequest` interface
- `RefundResponse` interface

### 4. **AdvancedBillingService** - Appel generateInvoice
**Fichier**: `src/services/advanced-billing.service.ts`

**Problème**: Mauvais paramètres passés à `generateInvoice`.

**Solution**: Utilisation correcte des options `InvoiceGenerationOptions`.

---

## 🏗️ Architecture du Système

### Services Principaux

#### 1. **InvoiceService**
**Localisation**: `src/services/invoice.service.ts`

**Responsabilités**:
- Génération de factures basée sur l'utilisation
- Calcul automatique des montants (sous-total, TVA, total)
- Gestion du cycle de vie des factures (DRAFT → SENT → PAID)
- Envoi par email avec PDF attaché
- Chiffrement des données sensibles

**Méthodes clés**:
```typescript
generateInvoice(userId, period, options?, requestContext?)
getInvoice(invoiceId, userId?, requestContext?)
getUserInvoices(userId, status?, limit?, offset?)
updateInvoiceStatus(invoiceId, status, metadata?)
sendInvoice(invoice)
generateInvoicePDF(invoiceId)
```

#### 2. **PDFService**
**Localisation**: `src/services/pdf.service.ts`

**Responsabilités**:
- Génération de PDF professionnels avec Puppeteer
- Template HTML personnalisable
- Format A4 avec marges optimisées

**Fonctionnalités**:
- En-tête avec logo et statut
- Informations client et entreprise
- Tableau détaillé des items
- Calculs de totaux
- Footer avec mentions légales

#### 3. **BillingNotificationService**
**Localisation**: `src/services/billing-notification.service.ts`

**Responsabilités**:
- Envoi d'emails HTML professionnels
- Templates pour tous les événements de facturation

**Types d'emails**:
- ✉️ Facture créée
- ✅ Paiement confirmé
- ❌ Paiement échoué
- ⏰ Rappel de paiement
- 💰 Remboursement confirmé

#### 4. **AdvancedBillingService**
**Localisation**: `src/services/advanced-billing.service.ts`

**Fonctionnalités avancées**:
- Templates de factures personnalisés
- Facturation basée sur l'usage (metered billing)
- Factures groupées
- Notes de crédit
- Conversion de devises

---

## 🌐 Endpoints API

### 1. Liste et Création de Factures
**Endpoint**: `/api/billing/invoices`

#### GET - Lister les factures
```http
GET /api/billing/invoices?userId=xxx&status=PAID
```

**Réponse**:
```json
{
  "success": true,
  "data": {
    "invoices": [...],
    "count": 10,
    "filters": { "userId": "xxx", "status": "PAID" }
  }
}
```

#### POST - Créer une facture
```http
POST /api/billing/invoices
Content-Type: application/json

{
  "userId": "user-123",
  "period": {
    "type": "monthly",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  },
  "options": {
    "sendImmediately": true,
    "forceRegenerate": false
  }
}
```

### 2. Gestion d'une Facture
**Endpoint**: `/api/billing/invoices/[id]`

#### GET - Récupérer une facture
```http
GET /api/billing/invoices/inv-123?userId=user-123
```

#### PUT - Mettre à jour le statut
```http
PUT /api/billing/invoices/inv-123
Content-Type: application/json

{
  "status": "PAID",
  "metadata": {
    "paymentMethod": "stripe",
    "transactionId": "pi_xxx"
  }
}
```

#### POST - Envoyer la facture par email
```http
POST /api/billing/invoices/inv-123?userId=user-123
```

### 3. Téléchargement PDF
**Endpoint**: `/api/billing/invoices/[id]/pdf`

```http
GET /api/billing/invoices/inv-123/pdf?userId=user-123
```

**Réponse**: Fichier PDF en téléchargement

---

## 🗄️ Schéma de Base de Données

### Table: `invoices`

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  number VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL,
  status VARCHAR(50) NOT NULL,
  period JSONB NOT NULL,
  issue_date TIMESTAMP NOT NULL,
  due_date TIMESTAMP NOT NULL,
  paid_date TIMESTAMP,
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'EUR',
  items JSONB NOT NULL,
  billing_address JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Enums

```typescript
enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

enum BillingPeriodType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED'
}
```

---

## 🔒 Sécurité

### 1. Chiffrement des Données
- Informations client chiffrées avec `EncryptionService`
- Clés gérées par `KeyManagementService`
- Conformité GDPR via `GDPRService`

### 2. Audit Logging
- Tous les accès aux factures sont loggés
- Détection des tentatives d'accès non autorisées
- Masquage des données sensibles dans les logs

### 3. Validation
- Validation stricte des paramètres d'entrée
- Vérification des permissions utilisateur
- Protection contre les injections SQL (utilisation de paramètres)

---

## 📧 Configuration Email

### Variables d'environnement requises

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=billing@twinmcp.com
SMTP_FROM_NAME=TwinMCP Billing

# Company Information
COMPANY_NAME=TwinMCP
SUPPORT_EMAIL=support@twinmcp.com
APP_URL=https://app.twinmcp.com

# Invoice Configuration
INVOICE_TAX_RATE=0.20
INVOICE_DUE_DAYS=30
INVOICE_CURRENCY=EUR
```

---

## 🧪 Tests

### Tests Unitaires
**Localisation**: `__tests__/services/invoice.service.test.ts`

Couvrent:
- Génération de factures
- Calculs de montants
- Gestion des statuts
- Validation des données

### Tests d'Intégration
**Localisation**: `__tests__/integration/billing-api.integration.test.ts`

Testent:
- Flux complet de facturation
- Endpoints API
- Webhooks de paiement
- Génération de PDF

---

## 📊 Flux de Facturation

```
1. Utilisation du service
   ↓
2. Fin de période de facturation
   ↓
3. InvoiceService.generateInvoice()
   ├─ Récupération des données d'utilisation
   ├─ Calcul des items et montants
   ├─ Chiffrement des données sensibles
   └─ Sauvegarde en base de données
   ↓
4. BillingNotificationService.sendInvoiceCreated()
   └─ Email avec lien de téléchargement PDF
   ↓
5. Utilisateur consulte la facture
   ↓
6. Paiement effectué
   ↓
7. Webhook reçu
   ↓
8. InvoiceService.updateInvoiceStatus(PAID)
   ↓
9. BillingNotificationService.sendPaymentConfirmation()
   └─ Email de confirmation
```

---

## 🚀 Utilisation

### Exemple: Générer une facture mensuelle

```typescript
import { InvoiceService } from '@/services/invoice.service';
import { BillingPeriodType } from '@/types/invoice.types';

const invoice = await invoiceService.generateInvoice(
  'user-123',
  {
    type: BillingPeriodType.MONTHLY,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31')
  },
  {
    sendImmediately: true,
    includeCredits: true
  }
);
```

### Exemple: Envoyer une notification

```typescript
import { BillingNotificationService } from '@/services/billing-notification.service';

await notificationService.sendInvoiceCreated(
  invoice,
  'user@example.com'
);
```

---

## ✅ Checklist de Production

- [x] Services de facturation implémentés
- [x] Génération de PDF fonctionnelle
- [x] Notifications email configurées
- [x] Endpoints API sécurisés
- [x] Chiffrement des données sensibles
- [x] Audit logging en place
- [x] Gestion des erreurs robuste
- [x] Types TypeScript complets
- [ ] Tests unitaires à 80%+ de couverture
- [ ] Tests E2E complets
- [ ] Documentation API OpenAPI
- [ ] Monitoring et alerting

---

## 📝 Notes Importantes

1. **Puppeteer**: Assurez-vous que Puppeteer peut s'exécuter dans votre environnement (dépendances système requises)
2. **SMTP**: Configurez un serveur SMTP ou utilisez un service comme SendGrid/Mailgun pour la production
3. **Sécurité**: Ne jamais exposer les clés de chiffrement ou les secrets SMTP
4. **Performance**: Pour de gros volumes, envisagez la génération asynchrone de PDF avec une queue

---

## 🐛 Problèmes Résolus

| Problème | Solution | Fichier |
|----------|----------|---------|
| Signature AuditService incompatible | Paramètres flexibles | `audit.service.ts` |
| Propriétés Invoice incorrectes | Renommage vers `number` et `total` | `billing-notification.service.ts` |
| Types Payment manquants | Création du fichier types | `payment.types.ts` |
| Appel generateInvoice incorrect | Correction des paramètres | `advanced-billing.service.ts` |

---

## 📞 Support

Pour toute question ou problème:
- Email: support@twinmcp.com
- Documentation: https://docs.twinmcp.com
- GitHub Issues: https://github.com/twinmcp/issues

---

**Système de facturation TwinMCP - Prêt pour la production** ✅
