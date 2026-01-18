import nodemailer, { Transporter } from 'nodemailer';
import { Invoice, InvoiceStatus } from '../types/invoice.types';
import { Payment, PaymentStatus } from '../types/payment.types';
import { AuditService } from './security/audit.service';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface NotificationOptions {
  to: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export class BillingNotificationService {
  private transporter: Transporter;
  private fromEmail: string;
  private fromName: string;
  private companyName: string;
  private supportEmail: string;

  constructor(private auditService: AuditService) {
    this.fromEmail = process.env.SMTP_FROM_EMAIL || 'billing@twinmcp.com';
    this.fromName = process.env.SMTP_FROM_NAME || 'TwinMCP Billing';
    this.companyName = process.env.COMPANY_NAME || 'TwinMCP';
    this.supportEmail = process.env.SUPPORT_EMAIL || 'support@twinmcp.com';

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendInvoiceCreated(
    invoice: Invoice,
    userEmail: string,
    options?: NotificationOptions
  ): Promise<void> {
    const template = this.getInvoiceCreatedTemplate(invoice);
    
    await this.sendEmail({
      to: options?.to || userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      cc: options?.cc,
      bcc: options?.bcc,
      attachments: options?.attachments,
    });

    await this.auditService.logAccess(
      invoice.userId,
      'notification',
      invoice.id,
      'invoice_created_email_sent',
      { email: userEmail }
    );
  }

  async sendPaymentConfirmation(
    payment: Payment,
    invoice: Invoice,
    userEmail: string,
    options?: NotificationOptions
  ): Promise<void> {
    const template = this.getPaymentConfirmationTemplate(payment, invoice);
    
    await this.sendEmail({
      to: options?.to || userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
      cc: options?.cc,
      bcc: options?.bcc,
      attachments: options?.attachments,
    });

    await this.auditService.logAccess(
      payment.userId,
      'notification',
      payment.id,
      'payment_confirmation_email_sent',
      { email: userEmail, amount: payment.amount }
    );
  }

  async sendPaymentFailed(
    payment: Payment,
    invoice: Invoice,
    userEmail: string,
    reason?: string
  ): Promise<void> {
    const template = this.getPaymentFailedTemplate(payment, invoice, reason);
    
    await this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    await this.auditService.logAccess(
      payment.userId,
      'notification',
      payment.id,
      'payment_failed_email_sent',
      { email: userEmail, reason }
    );
  }

  async sendPaymentReminder(
    invoice: Invoice,
    userEmail: string,
    daysOverdue: number
  ): Promise<void> {
    const template = this.getPaymentReminderTemplate(invoice, daysOverdue);
    
    await this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    await this.auditService.logAccess(
      invoice.userId,
      'notification',
      invoice.id,
      'payment_reminder_email_sent',
      { email: userEmail, daysOverdue }
    );
  }

  async sendRefundConfirmation(
    payment: Payment,
    invoice: Invoice,
    userEmail: string,
    refundAmount: number
  ): Promise<void> {
    const template = this.getRefundConfirmationTemplate(payment, invoice, refundAmount);
    
    await this.sendEmail({
      to: userEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    await this.auditService.logAccess(
      payment.userId,
      'notification',
      payment.id,
      'refund_confirmation_email_sent',
      { email: userEmail, refundAmount }
    );
  }

  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    cc?: string[];
    bcc?: string[];
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }>;
  }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      });
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Email sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getInvoiceCreatedTemplate(invoice: Invoice): EmailTemplate {
    const subject = `Nouvelle facture ${invoice.number} - ${this.companyName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .invoice-details { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .amount { font-size: 24px; font-weight: bold; color: #4F46E5; }
            .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Nouvelle Facture</h1>
            </div>
            <div class="content">
              <p>Bonjour,</p>
              <p>Votre facture <strong>${invoice.number}</strong> a été générée.</p>
              
              <div class="invoice-details">
                <p><strong>Numéro de facture:</strong> ${invoice.number}</p>
                <p><strong>Date d'émission:</strong> ${new Date(invoice.issueDate).toLocaleDateString('fr-FR')}</p>
                <p><strong>Date d'échéance:</strong> ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</p>
                <p><strong>Montant total:</strong> <span class="amount">${invoice.total.toFixed(2)} ${invoice.currency}</span></p>
              </div>
              
              <p>Vous pouvez télécharger votre facture en cliquant sur le bouton ci-dessous:</p>
              <a href="${process.env.APP_URL}/billing/invoices/${invoice.id}/pdf" class="button">Télécharger la facture</a>
              
              <p>Si vous avez des questions, n'hésitez pas à nous contacter à ${this.supportEmail}.</p>
            </div>
            <div class="footer">
              <p>${this.companyName} - Tous droits réservés</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Nouvelle Facture - ${this.companyName}

Bonjour,

Votre facture ${invoice.number} a été générée.

Détails de la facture:
- Numéro: ${invoice.number}
- Date d'émission: ${new Date(invoice.issueDate).toLocaleDateString('fr-FR')}
- Date d'échéance: ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}
- Montant total: ${invoice.total.toFixed(2)} ${invoice.currency}

Téléchargez votre facture: ${process.env.APP_URL}/billing/invoices/${invoice.id}/pdf

Pour toute question: ${this.supportEmail}

${this.companyName}
    `;

    return { subject, html, text };
  }

  private getPaymentConfirmationTemplate(payment: Payment, invoice: Invoice): EmailTemplate {
    const subject = `Confirmation de paiement - Facture ${invoice.number}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .payment-details { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Paiement Confirmé</h1>
            </div>
            <div class="content">
              <div class="success-icon">✓</div>
              <p>Bonjour,</p>
              <p>Nous avons bien reçu votre paiement pour la facture <strong>${invoice.number}</strong>.</p>
              
              <div class="payment-details">
                <p><strong>Montant payé:</strong> ${payment.amount.toFixed(2)} ${payment.currency}</p>
                <p><strong>Date de paiement:</strong> ${new Date(payment.createdAt).toLocaleDateString('fr-FR')}</p>
                <p><strong>Méthode de paiement:</strong> ${payment.provider}</p>
                <p><strong>ID de transaction:</strong> ${payment.transactionId}</p>
              </div>
              
              <p>Merci pour votre confiance!</p>
            </div>
            <div class="footer">
              <p>${this.companyName} - Tous droits réservés</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Paiement Confirmé - ${this.companyName}

Bonjour,

Nous avons bien reçu votre paiement pour la facture ${invoice.number}.

Détails du paiement:
- Montant: ${payment.amount.toFixed(2)} ${payment.currency}
- Date: ${new Date(payment.createdAt).toLocaleDateString('fr-FR')}
- Méthode: ${payment.provider}
- Transaction: ${payment.transactionId}

Merci pour votre confiance!

${this.companyName}
    `;

    return { subject, html, text };
  }

  private getPaymentFailedTemplate(payment: Payment, invoice: Invoice, reason?: string): EmailTemplate {
    const subject = `Échec de paiement - Facture ${invoice.number}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #EF4444; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .alert { background-color: #FEE2E2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠ Échec de Paiement</h1>
            </div>
            <div class="content">
              <p>Bonjour,</p>
              <p>Nous n'avons pas pu traiter votre paiement pour la facture <strong>${invoice.number}</strong>.</p>
              
              <div class="alert">
                <p><strong>Raison:</strong> ${reason || 'Erreur de traitement du paiement'}</p>
              </div>
              
              <p>Veuillez vérifier vos informations de paiement et réessayer.</p>
              <a href="${process.env.APP_URL}/billing/invoices/${invoice.id}" class="button">Réessayer le paiement</a>
              
              <p>Si le problème persiste, contactez-nous à ${this.supportEmail}.</p>
            </div>
            <div class="footer">
              <p>${this.companyName} - Tous droits réservés</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Échec de Paiement - ${this.companyName}

Bonjour,

Nous n'avons pas pu traiter votre paiement pour la facture ${invoice.number}.

Raison: ${reason || 'Erreur de traitement du paiement'}

Veuillez vérifier vos informations et réessayer: ${process.env.APP_URL}/billing/invoices/${invoice.id}

Contact: ${this.supportEmail}

${this.companyName}
    `;

    return { subject, html, text };
  }

  private getPaymentReminderTemplate(invoice: Invoice, daysOverdue: number): EmailTemplate {
    const subject = `Rappel de paiement - Facture ${invoice.number}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .reminder { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Rappel de Paiement</h1>
            </div>
            <div class="content">
              <p>Bonjour,</p>
              <p>Nous vous rappelons que la facture <strong>${invoice.number}</strong> est en attente de paiement.</p>
              
              <div class="reminder">
                <p><strong>Facture en retard de ${daysOverdue} jour(s)</strong></p>
                <p>Date d'échéance: ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</p>
                <p>Montant dû: ${invoice.total.toFixed(2)} ${invoice.currency}</p>
              </div>
              
              <p>Merci de procéder au paiement dans les plus brefs délais.</p>
              <a href="${process.env.APP_URL}/billing/invoices/${invoice.id}" class="button">Payer maintenant</a>
              
              <p>Si vous avez déjà effectué le paiement, veuillez ignorer ce message.</p>
            </div>
            <div class="footer">
              <p>${this.companyName} - Tous droits réservés</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Rappel de Paiement - ${this.companyName}

Bonjour,

La facture ${invoice.number} est en attente de paiement.

Retard: ${daysOverdue} jour(s)
Date d'échéance: ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}
Montant dû: ${invoice.total.toFixed(2)} ${invoice.currency}

Payer maintenant: ${process.env.APP_URL}/billing/invoices/${invoice.id}

Si vous avez déjà payé, ignorez ce message.

${this.companyName}
    `;

    return { subject, html, text };
  }

  private getRefundConfirmationTemplate(payment: Payment, invoice: Invoice, refundAmount: number): EmailTemplate {
    const subject = `Confirmation de remboursement - Facture ${invoice.number}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #6366F1; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .refund-details { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Remboursement Confirmé</h1>
            </div>
            <div class="content">
              <p>Bonjour,</p>
              <p>Votre remboursement a été traité avec succès.</p>
              
              <div class="refund-details">
                <p><strong>Facture:</strong> ${invoice.number}</p>
                <p><strong>Montant remboursé:</strong> ${refundAmount.toFixed(2)} ${payment.currency}</p>
                <p><strong>Méthode de remboursement:</strong> ${payment.provider}</p>
                <p><strong>Délai de traitement:</strong> 5-10 jours ouvrés</p>
              </div>
              
              <p>Le remboursement apparaîtra sur votre compte bancaire dans les prochains jours.</p>
            </div>
            <div class="footer">
              <p>${this.companyName} - Tous droits réservés</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Remboursement Confirmé - ${this.companyName}

Bonjour,

Votre remboursement a été traité avec succès.

Détails:
- Facture: ${invoice.number}
- Montant: ${refundAmount.toFixed(2)} ${payment.currency}
- Méthode: ${payment.provider}
- Délai: 5-10 jours ouvrés

${this.companyName}
    `;

    return { subject, html, text };
  }
}
