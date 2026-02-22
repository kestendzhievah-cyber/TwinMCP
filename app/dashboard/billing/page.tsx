'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  CreditCard,
  Receipt,
  Crown,
  Zap,
  Shield,
  CheckCircle,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  AlertTriangle,
  Loader2,
  Download,
  FileText,
  Gift,
  Settings,
} from 'lucide-react';

interface BillingData {
  subscription: {
    id: string;
    plan: string;
    status: string;
    amount: number;
    currency: string;
    interval: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    trialEnd: string | null;
  } | null;
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: string;
    features: string[];
  };
  invoices: {
    id: string;
    number: string;
    status: string;
    amount: number;
    currency: string;
    issueDate: string;
    dueDate: string;
    paidDate: string | null;
  }[];
  payments: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    processedAt: string | null;
  }[];
  credits: {
    total: number;
    items: {
      id: string;
      amount: number;
      currency: string;
      reason: string;
      type: string;
      expiresAt: string | null;
    }[];
  };
  billingProfile: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    postalCode: string | null;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-green-500/20 text-green-400',
  SENT: 'bg-blue-500/20 text-blue-400',
  DRAFT: 'bg-gray-500/20 text-gray-400',
  OVERDUE: 'bg-red-500/20 text-red-400',
  CANCELLED: 'bg-gray-500/20 text-gray-500',
  ACTIVE: 'bg-green-500/20 text-green-400',
  COMPLETED: 'bg-green-500/20 text-green-400',
  PENDING: 'bg-yellow-500/20 text-yellow-400',
  PROCESSING: 'bg-blue-500/20 text-blue-400',
  FAILED: 'bg-red-500/20 text-red-400',
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Zap className="w-6 h-6 text-gray-400" />,
  pro: <Crown className="w-6 h-6 text-purple-400" />,
  enterprise: <Shield className="w-6 h-6 text-yellow-400" />,
};

export default function BillingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchBillingData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      let token = '';
      try {
        token = await user.getIdToken();
      } catch (tokenError) {
        console.warn('Could not get ID token');
      }

      const response = await fetch('/api/v1/billing', {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Erreur de chargement');
      }
    } catch (err) {
      console.error('Billing fetch error:', err);
      setError('Impossible de charger les données de facturation');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
      return;
    }

    if (user) {
      fetchBillingData();
    }
  }, [user, authLoading, router, fetchBillingData]);

  const handleDownloadPDF = async (invoice: BillingData['invoices'][number]) => {
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
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  // Loading state
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-purple-400" />
            Facturation
          </h1>
          <p className="text-gray-400 mt-1">
            Gérez votre abonnement, factures et moyens de paiement
          </p>
        </div>
        
        <button
          onClick={fetchBillingData}
          disabled={loading}
          className="p-2.5 bg-[#1a1b2e] border border-purple-500/30 text-white rounded-xl hover:bg-purple-500/10 transition"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-yellow-400 font-medium">Attention</p>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Current Plan */}
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[#1a1b2e] rounded-xl">
                  {PLAN_ICONS[data.plan.id] || PLAN_ICONS.free}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Plan {data.plan.name}
                    {data.subscription?.status === 'ACTIVE' && (
                      <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                        Actif
                      </span>
                    )}
                  </h2>
                  {data.subscription ? (
                    <p className="text-gray-400 text-sm mt-1">
                      {formatCurrency(data.subscription.amount, data.subscription.currency)} / {data.subscription.interval === 'MONTH' ? 'mois' : 'an'}
                      {data.subscription.cancelAtPeriodEnd && (
                        <span className="text-yellow-400 ml-2">• Se termine le {formatDate(data.subscription.currentPeriodEnd)}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-gray-400 text-sm mt-1">
                      {data.plan.price > 0 ? `${formatCurrency(data.plan.price)} / ${data.plan.interval}` : 'Gratuit'}
                    </p>
                  )}
                  {data.subscription?.trialEnd && new Date(data.subscription.trialEnd) > new Date() && (
                    <p className="text-purple-400 text-sm mt-1">
                      Essai gratuit jusqu'au {formatDate(data.subscription.trialEnd)}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3">
                {data.plan.id === 'free' ? (
                  <Link
                    href="/pricing"
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-pink-600 transition flex items-center gap-2"
                    data-testid="upgrade-plan-btn"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Passer au Pro
                  </Link>
                ) : (
                  <button
                    className="px-5 py-2.5 bg-[#1a1b2e] border border-purple-500/30 text-white font-medium rounded-xl hover:bg-purple-500/10 transition flex items-center gap-2"
                    data-testid="manage-subscription-btn"
                  >
                    <Settings className="w-4 h-4" />
                    Gérer l'abonnement
                  </button>
                )}
              </div>
            </div>

            {/* Plan Features */}
            <div className="mt-6 pt-6 border-t border-purple-500/20">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Fonctionnalités incluses</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {data.plan.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-white">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            {/* Billing Period */}
            {data.subscription && (
              <div className="mt-4 pt-4 border-t border-purple-500/20 flex items-center gap-2 text-sm text-gray-400">
                <Calendar className="w-4 h-4" />
                Période actuelle : {formatDate(data.subscription.currentPeriodStart)} - {formatDate(data.subscription.currentPeriodEnd)}
              </div>
            )}
          </div>

          {/* Credits */}
          {data.credits.total > 0 && (
            <div className="bg-[#1a1b2e] border border-green-500/20 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Gift className="w-5 h-5 text-green-400" />
                  Crédits disponibles
                </h2>
                <span className="text-2xl font-bold text-green-400">
                  {formatCurrency(data.credits.total)}
                </span>
              </div>
              {data.credits.items.length > 0 && (
                <div className="space-y-2">
                  {data.credits.items.slice(0, 3).map((credit) => (
                    <div key={credit.id} className="flex items-center justify-between p-3 bg-[#0f1020] rounded-lg">
                      <div>
                        <p className="text-white text-sm">{credit.reason}</p>
                        <p className="text-gray-500 text-xs capitalize">{credit.type.toLowerCase()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-semibold">{formatCurrency(credit.amount, credit.currency)}</p>
                        {credit.expiresAt && (
                          <p className="text-gray-500 text-xs">Expire le {formatDate(credit.expiresAt)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Invoices */}
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-400" />
                Factures récentes
              </h2>
              <Link
                href="/dashboard/invoices"
                className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                Voir tout
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

            {data.invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-400 border-b border-purple-500/10">
                      <th className="pb-3 font-medium">Numéro</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Montant</th>
                      <th className="pb-3 font-medium">Statut</th>
                      <th className="pb-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-purple-500/10 last:border-0">
                        <td className="py-4">
                          <span className="text-white font-medium">{invoice.number}</span>
                        </td>
                        <td className="py-4 text-gray-400">{formatDate(invoice.issueDate)}</td>
                        <td className="py-4 text-white font-medium">
                          {formatCurrency(invoice.amount, invoice.currency)}
                        </td>
                        <td className="py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[invoice.status] || STATUS_COLORS.DRAFT}`}>
                            {invoice.status === 'PAID' ? 'Payée' : 
                             invoice.status === 'SENT' ? 'Envoyée' :
                             invoice.status === 'OVERDUE' ? 'En retard' :
                             invoice.status === 'CANCELLED' ? 'Annulée' : 'Brouillon'}
                          </span>
                        </td>
                        <td className="py-4">
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
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucune facture pour le moment</p>
              </div>
            )}
          </div>

          {/* Recent Payments */}
          <div className="bg-[#1a1b2e] border border-purple-500/20 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
              <CreditCard className="w-5 h-5 text-purple-400" />
              Paiements récents
            </h2>

            {data.payments.length > 0 ? (
              <div className="space-y-3">
                {data.payments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 bg-[#0f1020] rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        payment.status === 'COMPLETED' ? 'bg-green-400' :
                        payment.status === 'PENDING' ? 'bg-yellow-400' :
                        payment.status === 'PROCESSING' ? 'bg-blue-400' : 'bg-red-400'
                      }`} />
                      <div>
                        <p className="text-white font-medium">{formatCurrency(payment.amount, payment.currency)}</p>
                        <p className="text-gray-500 text-sm">{formatDate(payment.createdAt)}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[payment.status] || STATUS_COLORS.PENDING}`}>
                      {payment.status === 'COMPLETED' ? 'Réussi' :
                       payment.status === 'PENDING' ? 'En attente' :
                       payment.status === 'PROCESSING' ? 'En cours' : 'Échoué'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Aucun paiement enregistré</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
