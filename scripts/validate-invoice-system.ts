import { Pool } from 'pg';
import { InvoiceService } from '../src/services/invoice.service';
import { BillingNotificationService } from '../src/services/billing-notification.service';
import { PDFService } from '../src/services/pdf.service';
import { AdvancedBillingService } from '../src/services/advanced-billing.service';
import { EncryptionService } from '../src/services/security/encryption.service';
import { AuditService } from '../src/services/security/audit.service';
import { GDPRService } from '../src/services/security/gdpr.service';
import { DataMaskingService } from '../src/services/security/data-masking.service';
import { KeyManagementService } from '../src/services/security/kms.service';
import { BillingPeriodType } from '../src/types/invoice.types';

interface ValidationResult {
  component: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

class InvoiceSystemValidator {
  private db: Pool;
  private results: ValidationResult[] = [];

  constructor() {
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async validate(): Promise<void> {
    console.log('🔍 Validation du système de facturation TwinMCP\n');
    console.log('='.repeat(60));

    await this.validateDatabaseConnection();
    await this.validateDatabaseSchema();
    await this.validateServices();
    await this.validateTypes();
    await this.validateMigrations();
    await this.validateEnvironmentVariables();

    this.printResults();
    await this.cleanup();
  }

  private async validateDatabaseConnection(): Promise<void> {
    try {
      await this.db.query('SELECT NOW()');
      this.addResult('Database Connection', 'success', 'Connexion à la base de données réussie');
    } catch (error) {
      this.addResult('Database Connection', 'error', `Échec de connexion: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'}`);
    }
  }

  private async validateDatabaseSchema(): Promise<void> {
    const requiredTables = [
      'invoices',
      'payments',
      'payment_methods',
      'credits',
      'credit_notes',
      'subscriptions',
      'usage_records',
      'invoice_templates',
      'billing_alerts',
      'audit_logs',
      'security_events'
    ];

    for (const table of requiredTables) {
      try {
        const result = await this.db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )
        `, [table]);

        if (result.rows[0].exists) {
          this.addResult(`Table: ${table}`, 'success', 'Table existe');
        } else {
          this.addResult(`Table: ${table}`, 'error', 'Table manquante');
        }
      } catch (error) {
        this.addResult(`Table: ${table}`, 'error', `Erreur de vérification: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown'}`);
      }
    }
  }

  private async validateServices(): Promise<void> {
    try {
      const kms = new KeyManagementService();
      const encryptionService = new EncryptionService(kms);
      const maskingService = new DataMaskingService();
      const auditService = new AuditService(this.db, maskingService);
      const gdprService = new GDPRService(this.db, encryptionService, auditService);

      // Test InvoiceService
      const invoiceService = new InvoiceService(
        this.db,
        encryptionService,
        auditService,
        gdprService,
        maskingService
      );
      this.addResult('InvoiceService', 'success', 'Service initialisé correctement');

      // Test BillingNotificationService
      const notificationService = new BillingNotificationService(auditService);
      this.addResult('BillingNotificationService', 'success', 'Service initialisé correctement');

      // Test PDFService
      const pdfService = new PDFService();
      this.addResult('PDFService', 'success', 'Service initialisé correctement');

      // Test AdvancedBillingService
      const advancedBillingService = new AdvancedBillingService(
        this.db,
        invoiceService,
        auditService
      );
      this.addResult('AdvancedBillingService', 'success', 'Service initialisé correctement');

    } catch (error) {
      this.addResult('Services', 'error', `Erreur d'initialisation: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown'}`);
    }
  }

  private validateTypes(): void {
    try {
      // Vérifier que les types sont importables
      const invoiceTypes = require('../src/types/invoice.types');
      const paymentTypes = require('../src/types/payment.types');

      const requiredInvoiceTypes = [
        'InvoiceStatus',
        'BillingPeriodType',
        'Invoice',
        'InvoiceItem',
        'BillingPeriod',
        'BillingAddress'
      ];

      const requiredPaymentTypes = [
        'PaymentStatus',
        'PaymentProvider',
        'Payment',
        'PaymentIntent',
        'PaymentMethod'
      ];

      let allTypesValid = true;

      for (const type of requiredInvoiceTypes) {
        if (!invoiceTypes[type]) {
          this.addResult(`Type: ${type}`, 'error', 'Type manquant dans invoice.types.ts');
          allTypesValid = false;
        }
      }

      for (const type of requiredPaymentTypes) {
        if (!paymentTypes[type]) {
          this.addResult(`Type: ${type}`, 'error', 'Type manquant dans payment.types.ts');
          allTypesValid = false;
        }
      }

      if (allTypesValid) {
        this.addResult('TypeScript Types', 'success', 'Tous les types requis sont définis');
      }
    } catch (error) {
      this.addResult('TypeScript Types', 'error', `Erreur de validation: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown'}`);
    }
  }

  private async validateMigrations(): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    const migrationsDir = path.join(__dirname, '../prisma/migrations');
    
    try {
      if (fs.existsSync(migrationsDir)) {
        const files = fs.readdirSync(migrationsDir);
        const sqlFiles = files.filter((f: string) => f.endsWith('.sql'));
        
        this.addResult('Migrations', 'success', `${sqlFiles.length} fichiers de migration trouvés`, {
          files: sqlFiles
        });

        // Vérifier la migration complète
        if (sqlFiles.includes('complete_invoice_system.sql')) {
          this.addResult('Migration complète', 'success', 'Migration complete_invoice_system.sql présente');
        } else {
          this.addResult('Migration complète', 'warning', 'Migration complete_invoice_system.sql manquante');
        }
      } else {
        this.addResult('Migrations', 'warning', 'Répertoire migrations non trouvé');
      }
    } catch (error) {
      this.addResult('Migrations', 'error', `Erreur: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown'}`);
    }
  }

  private validateEnvironmentVariables(): void {
    const requiredVars = [
      'DATABASE_URL',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'SMTP_FROM_EMAIL',
      'INVOICE_TAX_RATE',
      'INVOICE_DUE_DAYS',
      'INVOICE_CURRENCY'
    ];

    const optionalVars = [
      'STRIPE_SECRET_KEY',
      'PAYPAL_CLIENT_ID',
      'PAYPAL_CLIENT_SECRET'
    ];

    let missingRequired = 0;
    let missingOptional = 0;

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        this.addResult(`Env: ${varName}`, 'error', 'Variable d\'environnement requise manquante');
        missingRequired++;
      }
    }

    for (const varName of optionalVars) {
      if (!process.env[varName]) {
        this.addResult(`Env: ${varName}`, 'warning', 'Variable d\'environnement optionnelle manquante');
        missingOptional++;
      }
    }

    if (missingRequired === 0) {
      this.addResult('Environment Variables', 'success', 'Toutes les variables requises sont définies');
    }

    if (missingOptional > 0) {
      this.addResult('Optional Variables', 'warning', `${missingOptional} variables optionnelles manquantes`);
    }
  }

  private addResult(component: string, status: 'success' | 'error' | 'warning', message: string, details?: any): void {
    this.results.push({ component, status, message, details });
  }

  private printResults(): void {
    console.log('\n📊 Résultats de validation:\n');

    const successCount = this.results.filter(r => r.status === 'success').length;
    const errorCount = this.results.filter(r => r.status === 'error').length;
    const warningCount = this.results.filter(r => r.status === 'warning').length;

    // Grouper par statut
    const errors = this.results.filter(r => r.status === 'error');
    const warnings = this.results.filter(r => r.status === 'warning');
    const successes = this.results.filter(r => r.status === 'success');

    if (errors.length > 0) {
      console.log('❌ ERREURS:');
      errors.forEach(r => {
        console.log(`  - ${r.component}: ${r.message}`);
        if (r.details) console.log(`    Détails: ${JSON.stringify(r.details, null, 2)}`);
      });
      console.log('');
    }

    if (warnings.length > 0) {
      console.log('⚠️  AVERTISSEMENTS:');
      warnings.forEach(r => {
        console.log(`  - ${r.component}: ${r.message}`);
        if (r.details) console.log(`    Détails: ${JSON.stringify(r.details, null, 2)}`);
      });
      console.log('');
    }

    if (successes.length > 0) {
      console.log('✅ SUCCÈS:');
      successes.forEach(r => {
        console.log(`  - ${r.component}: ${r.message}`);
      });
      console.log('');
    }

    console.log('='.repeat(60));
    console.log(`\n📈 Résumé: ${successCount} succès, ${warningCount} avertissements, ${errorCount} erreurs\n`);

    if (errorCount === 0) {
      console.log('✨ Le système de facturation est prêt pour la production!\n');
    } else {
      console.log('⚠️  Des erreurs doivent être corrigées avant la mise en production.\n');
      process.exit(1);
    }
  }

  private async cleanup(): Promise<void> {
    await this.db.end();
  }
}

// Exécution du script
const validator = new InvoiceSystemValidator();
validator.validate().catch(error => {
  console.error('❌ Erreur fatale lors de la validation:', error);
  process.exit(1);
});
