'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  Receipt,
  Download,
  FileText,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowLeft,
  Eye,
} from 'lucide-react';

interface InvoiceRow {
  id: string;
  number: string;
  status: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  paidDate: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-green-500/20 text-green-400',
  SENT: 'bg-blue-500/20 text-blue-400',
  DRAFT: 'bg-gray-500/20 text-gray-400',
  OVERDUE: 'bg-red-500/20 text-red-400',
  CANCELLED: 'bg-gray-500/20 text-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Payée',
  SENT: 'Envoyée',
  DRAFT: 'Brouillon',
  OVERDUE: 'En retard',
  CANCELLED: 'Annulée',
};

export default function InvoicesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      let token = '';
      try {
        token = await user.getIdToken();
      } catch { /* continue without token */ }

      const response = await fetch('/api/v1/billing', {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        let allInvoices: InvoiceRow[] = result.data?.invoices || [];
        if (filter !== 'ALL') {
          allInvoices = allInvoices.filter((inv: InvoiceRow) => inv.status === filter);
        }
        setInvoices(allInvoices);
      } else {
        setError(result.error || 'Erreur de chargement');
      }
    } catch (err) {
      console.error('Invoices fetch error:', err);
      setError('Impossible de charger les factures');
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
      return;
    }
    if (user) {
      fetchInvoices();
    }
  }, [user, authLoading, router, fetchInvoices]);

  const handleDownloadPDF = async (invoice: InvoiceRow) => {
    if (!user) return;

    setDownloadingId(invoice.id);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/billing/invoices/${invoice.id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Échec du téléchargement');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facture-${invoice.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('PDF download error:', err);
      setError('Échec du téléchargement du PDF');
      setTimeout(() => setError(null), 5000);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-7 h-7 text-purple-400" />
            Factures
          </h1>
          <p className="text-gray-400 mt-1">
            Consultez et téléchargez vos factures
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchInvoices}
            disabled={loading}
            className="p-2.5 bg-[#1a1b2e] border border-purple-500/30 text-white rounded-xl hover:bg-purple-500/10 transition"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2.5 bg-[#1a1b2e] border border-purple-500/20 rounded-xl text-white focus:outline-none focus:border-purple-500/50 transition cursor-pointer"
          >
            <option value="ALL">Toutes</option>
            <option value="DRAFT">Brouillon</option>
            <option value="SENT">Envoyées</option>
            <option value="PAID">Payées</option>
            <option value="OVERDUE">En retard</option>
            <option value="CANCELLED">Annulées</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Invoice Table */}
      {invoices.length === 0 ? (
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-12 text-center">
          <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Aucune facture</h3>
          <p className="text-gray-400">Vos factures apparaîtront ici une fois générées</p>
        </div>
      ) : (
        <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-purple-500/10">
                  <th className="px-6 py-4 font-medium">Numéro</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Échéance</th>
                  <th className="px-6 py-4 font-medium">Montant</th>
                  <th className="px-6 py-4 font-medium">Statut</th>
                  <th className="px-6 py-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-purple-500/10 last:border-0 hover:bg-purple-500/5 transition">
                    <td className="px-6 py-4">
                      <span className="text-white font-medium">{invoice.number}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {formatDate(invoice.issueDate)}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-6 py-4 text-white font-medium">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[invoice.status] || STATUS_COLORS.DRAFT}`}>
                        {STATUS_LABELS[invoice.status] || invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDownloadPDF(invoice)}
                        disabled={downloadingId === invoice.id}
                        className="p-2 text-gray-400 hover:text-purple-400 transition disabled:opacity-50"
                        title="Télécharger le PDF"
                      >
                        {downloadingId === invoice.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
