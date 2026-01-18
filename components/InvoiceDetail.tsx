'use client';

import React from 'react';
import { Invoice, InvoiceStatus } from '@/types/invoice.types';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface InvoiceDetailProps {
  invoice: Invoice;
  onClose?: () => void;
  onDownloadPDF?: () => void;
}

export function InvoiceDetail({ invoice, onClose, onDownloadPDF }: InvoiceDetailProps) {
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return 'bg-green-100 text-green-800';
      case InvoiceStatus.SENT:
        return 'bg-blue-100 text-blue-800';
      case InvoiceStatus.OVERDUE:
        return 'bg-red-100 text-red-800';
      case InvoiceStatus.CANCELLED:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Invoice {invoice.number}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
              {invoice.status}
            </span>
          </div>
          <div className="flex gap-2">
            {onDownloadPDF && (
              <Button onClick={onDownloadPDF}>
                Download PDF
              </Button>
            )}
            {onClose && (
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-2">Bill To</h3>
            <div className="text-sm">
              <p className="font-medium">{invoice.billingAddress.name}</p>
              <p>{invoice.billingAddress.email}</p>
              {invoice.billingAddress.phone && <p>{invoice.billingAddress.phone}</p>}
              <p>{invoice.billingAddress.address}</p>
              <p>
                {invoice.billingAddress.city}, {invoice.billingAddress.state} {invoice.billingAddress.postalCode}
              </p>
              <p>{invoice.billingAddress.country}</p>
            </div>
          </div>

          <div className="text-right">
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Issue Date:</span>
                <span className="ml-2 font-medium">{formatDate(invoice.issueDate)}</span>
              </div>
              <div>
                <span className="text-gray-500">Due Date:</span>
                <span className="ml-2 font-medium">{formatDate(invoice.dueDate)}</span>
              </div>
              {invoice.paidAt && (
                <div>
                  <span className="text-gray-500">Paid Date:</span>
                  <span className="ml-2 font-medium">{formatDate(invoice.paidAt)}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Period:</span>
                <span className="ml-2 font-medium">
                  {formatDate(invoice.period.startDate)} - {formatDate(invoice.period.endDate)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 px-4">Description</th>
                <th className="text-right py-3 px-4">Quantity</th>
                <th className="text-right py-3 px-4">Unit Price</th>
                <th className="text-right py-3 px-4">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      {item.type && (
                        <p className="text-sm text-gray-500 capitalize">{item.type}</p>
                      )}
                    </div>
                  </td>
                  <td className="text-right py-3 px-4">{item.quantity.toLocaleString()}</td>
                  <td className="text-right py-3 px-4">
                    {formatCurrency(item.unitPrice, invoice.currency)}
                  </td>
                  <td className="text-right py-3 px-4 font-medium">
                    {formatCurrency(item.amount, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax:</span>
              <span className="font-medium">{formatCurrency(invoice.tax, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t-2 border-gray-300 pt-2">
              <span>Total:</span>
              <span>{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
          </div>
        </div>

        {invoice.metadata?.notes && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
            <p className="text-sm text-gray-600">{invoice.metadata.notes}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
