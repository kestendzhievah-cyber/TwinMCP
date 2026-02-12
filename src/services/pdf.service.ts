import puppeteer from 'puppeteer';
import { Invoice } from '../types/invoice.types';

export class PDFService {
  async generateInvoicePDF(invoice: Invoice): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Générer le HTML de la facture
      const html = this.generateInvoiceHTML(invoice);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Générer le PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        }
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private generateInvoiceHTML(invoice: Invoice): string {
    const formatDate = (date: Date) => new Date(date).toLocaleDateString('fr-FR');
    const formatCurrency = (amount: number) => 
      new Intl.NumberFormat('fr-FR', { style: 'currency', currency: invoice.currency }).format(amount);

    const statusClass = invoice.status.toLowerCase();
    const statusLabel = invoice.status.toUpperCase();

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Facture ${invoice.number}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
        }
        .company-info {
            text-align: left;
            margin-bottom: 20px;
        }
        .invoice-info {
            text-align: right;
            margin-bottom: 20px;
        }
        .customer-info {
            margin-bottom: 30px;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .items-table th,
        .items-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        .items-table th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .items-table .amount {
            text-align: right;
        }
        .totals {
            text-align: right;
            margin-top: 20px;
        }
        .total-row {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 10px;
        }
        .total-label {
            width: 200px;
            text-align: right;
            padding-right: 20px;
        }
        .total-value {
            width: 150px;
            text-align: right;
            font-weight: bold;
        }
        .grand-total {
            border-top: 2px solid #2563eb;
            padding-top: 10px;
            font-size: 1.2em;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 0.9em;
            color: #666;
        }
        .status {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 4px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status.draft { background-color: #fef3c7; color: #92400e; }
        .status.sent { background-color: #dbeafe; color: #1e40af; }
        .status.paid { background-color: #d1fae5; color: #065f46; }
        .status.overdue { background-color: #fee2e2; color: #991b1b; }
        .status.cancelled { background-color: #f3f4f6; color: #374151; }
    </style>
</head>
<body>
    <div class="header">
        <h1>TwinMCP - Facture</h1>
        <p class="status ${statusClass}">${statusLabel}</p>
    </div>

    <div class="company-info">
        <strong>TwinMCP</strong><br>
        Service de facturation<br>
        support@twinmcp.com<br>
        TVA: FR12345678901
    </div>

    <div class="invoice-info">
        <strong>Facture n°:</strong> ${invoice.number}<br>
        <strong>Date d'émission:</strong> ${formatDate(invoice.issueDate)}<br>
        <strong>Date d'échéance:</strong> ${formatDate(invoice.dueDate)}<br>
        ${invoice.paidAt ? `<strong>Date de paiement:</strong> ${formatDate(invoice.paidAt)}<br>` : ''}
    </div>

    <div class="customer-info">
        <h3>Informations client</h3>
        <p><strong>ID Client:</strong> ${invoice.userId}</p>
        ${invoice.metadata?.customerInfo ? `
            <p><strong>Email:</strong> ${invoice.metadata.customerInfo.email || 'N/A'}</p>
            <p><strong>Nom:</strong> ${invoice.metadata.customerInfo.name || 'N/A'}</p>
        ` : ''}
    </div>

    <div class="period-info">
        <h3>Période de facturation</h3>
        <p>${formatDate(invoice.period.startDate)} - ${formatDate(invoice.period.endDate)}</p>
        <p><strong>Type:</strong> ${invoice.period.type}</p>
    </div>

    <table class="items-table">
        <thead>
            <tr>
                <th>Description</th>
                <th>Quantité</th>
                <th>Prix unitaire</th>
                <th class="amount">Montant</th>
            </tr>
        </thead>
        <tbody>
            ${invoice.items.map(item => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.quantity.toLocaleString('fr-FR')}</td>
                    <td>${formatCurrency(item.unitPrice)}</td>
                    <td class="amount">${formatCurrency(item.amount)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="totals">
        <div class="total-row">
            <div class="total-label">Sous-total:</div>
            <div class="total-value">${formatCurrency(invoice.subtotal)}</div>
        </div>
        <div class="total-row">
            <div class="total-label">TVA (20%):</div>
            <div class="total-value">${formatCurrency(invoice.tax)}</div>
        </div>
        <div class="total-row grand-total">
            <div class="total-label">Total:</div>
            <div class="total-value">${formatCurrency(invoice.total)}</div>
        </div>
    </div>

    <div class="footer">
        <p>Merci de votre confiance !</p>
        <p>Pour toute question, contactez-nous à support@twinmcp.com</p>
        <p>TwinMCP - Service de facturation automatisée</p>
    </div>
</body>
</html>`;
  }
}
