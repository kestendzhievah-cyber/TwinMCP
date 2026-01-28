'use client';

import { useState, useEffect } from 'react';
import { InvoiceList } from '@/components/InvoiceList';
import { InvoiceDetail } from '@/components/InvoiceDetail';
import { Invoice } from '@/types/invoice.types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function InvoicesPage() {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const data = await response.json();
          setUserId(data?.user?.id || '');
        }
      } catch (error) {
        console.error('Error fetching user session:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
  };

  const handleCloseDetail = () => {
    setSelectedInvoice(null);
  };

  const handleDownloadPDF = async () => {
    if (!selectedInvoice) return;

    try {
      const response = await fetch(`/api/billing/invoices/${selectedInvoice.id}/pdf?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${selectedInvoice.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download invoice PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <Card className="p-6 sm:p-8 text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Authentication Required</h2>
          <p className="text-sm sm:text-base text-gray-600 mb-4">Please log in to view your invoices.</p>
          <Button onClick={() => window.location.href = '/auth'}>
            Log In
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Invoices</h1>
        <p className="text-sm sm:text-base text-gray-600">Manage and view your billing invoices</p>
      </div>

      {selectedInvoice ? (
        <InvoiceDetail
          invoice={selectedInvoice}
          onClose={handleCloseDetail}
          onDownloadPDF={handleDownloadPDF}
        />
      ) : (
        <InvoiceList
          userId={userId}
          onViewInvoice={handleViewInvoice}
        />
      )}
    </div>
  );
}
