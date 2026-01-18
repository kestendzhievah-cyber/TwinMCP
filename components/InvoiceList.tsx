'use client';

import React, { useState, useEffect } from 'react';
import { Invoice, InvoiceStatus } from '@/types/invoice.types';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface InvoiceListProps {
  userId: string;
  onViewInvoice?: (invoice: Invoice) => void;
}

export function InvoiceList({ userId, onViewInvoice }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InvoiceStatus | 'ALL'>('ALL');

  useEffect(() => {
    fetchInvoices();
  }, [userId, filter]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const statusParam = filter !== 'ALL' ? `&status=${filter}` : '';
      const response = await fetch(`/api/billing/invoices?userId=${userId}${statusParam}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      const result = await response.json();
      setInvoices(result.data?.invoices || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/pdf?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Failed to download invoice PDF');
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Error: {error}</p>
        <Button onClick={fetchInvoices} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Invoices</h2>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as InvoiceStatus | 'ALL')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ALL">All Invoices</option>
            <option value={InvoiceStatus.DRAFT}>Draft</option>
            <option value={InvoiceStatus.SENT}>Sent</option>
            <option value={InvoiceStatus.PAID}>Paid</option>
            <option value={InvoiceStatus.OVERDUE}>Overdue</option>
            <option value={InvoiceStatus.CANCELLED}>Cancelled</option>
          </select>
        </div>
      </div>

      {invoices.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">No invoices found</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invoices.map((invoice) => (
            <Card key={invoice.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{invoice.number}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                      {invoice.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <p className="font-medium">Issue Date</p>
                      <p>{formatDate(invoice.issueDate)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Due Date</p>
                      <p>{formatDate(invoice.dueDate)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Amount</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </p>
                    </div>
                    {invoice.paidAt && (
                      <div>
                        <p className="font-medium">Paid Date</p>
                        <p>{formatDate(invoice.paidAt)}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {onViewInvoice && (
                    <Button
                      onClick={() => onViewInvoice(invoice)}
                      variant="outline"
                    >
                      View
                    </Button>
                  )}
                  <Button
                    onClick={() => downloadPDF(invoice.id, invoice.number)}
                    variant="default"
                  >
                    Download PDF
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
