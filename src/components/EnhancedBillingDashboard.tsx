'use client';

import { logger } from '../utils/logger';
import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface RevenueData {
  month: string;
  revenue: number;
  invoices: number;
}

interface PaymentMethodData {
  name: string;
  value: number;
  color: string;
}

interface InvoiceStatusData {
  status: string;
  count: number;
  amount: number;
}

interface BillingMetrics {
  totalRevenue: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  overdueInvoices: number;
  averageInvoiceValue: number;
  conversionRate: number;
  monthlyRecurringRevenue: number;
}

export default function EnhancedBillingDashboard() {
  const [metrics, setMetrics] = useState<BillingMetrics | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<PaymentMethodData[]>([]);
  const [invoiceStatusData, setInvoiceStatusData] = useState<InvoiceStatusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, revenueRes, paymentsRes, statusRes] = await Promise.all([
        fetch(`/api/billing/metrics?range=${dateRange}`),
        fetch(`/api/billing/revenue?range=${dateRange}`),
        fetch(`/api/billing/payment-methods?range=${dateRange}`),
        fetch(`/api/billing/invoice-status?range=${dateRange}`),
      ]);

      const metricsData = await metricsRes.json();
      const revenueDataRes = await revenueRes.json();
      const paymentMethodDataRes = await paymentsRes.json();
      const invoiceStatusDataRes = await statusRes.json();

      setMetrics(metricsData);
      setRevenueData(revenueDataRes);
      setPaymentMethodData(paymentMethodDataRes);
      setInvoiceStatusData(invoiceStatusDataRes);
    } catch (error) {
      logger.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      const response = await fetch(`/api/billing/export?format=${format}&range=${dateRange}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing-report-${dateRange}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      logger.error('Failed to export data:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord Facturation</h1>
          
          <div className="flex gap-4">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="7d">7 derniers jours</option>
              <option value="30d">30 derniers jours</option>
              <option value="90d">90 derniers jours</option>
              <option value="1y">1 an</option>
            </select>

            <div className="relative">
              <button
                onClick={() => document.getElementById('export-menu')?.classList.toggle('hidden')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Exporter
              </button>
              <div
                id="export-menu"
                className="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10"
              >
                <button
                  onClick={() => exportData('csv')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  CSV
                </button>
                <button
                  onClick={() => exportData('excel')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Excel
                </button>
                <button
                  onClick={() => exportData('pdf')}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title="Revenu Total"
              value={`${metrics.totalRevenue.toLocaleString('fr-FR')} €`}
              trend="+12.5%"
              trendUp={true}
              icon="💰"
            />
            <MetricCard
              title="Factures Payées"
              value={metrics.paidInvoices.toString()}
              subtitle={`sur ${metrics.totalInvoices} factures`}
              icon="✓"
            />
            <MetricCard
              title="Taux de Conversion"
              value={`${metrics.conversionRate.toFixed(1)}%`}
              trend="+3.2%"
              trendUp={true}
              icon="📈"
            />
            <MetricCard
              title="MRR"
              value={`${metrics.monthlyRecurringRevenue.toLocaleString('fr-FR')} €`}
              subtitle="Revenu Récurrent Mensuel"
              icon="🔄"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Évolution du Revenu</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4F46E5"
                  strokeWidth={2}
                  name="Revenu (€)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Méthodes de Paiement</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Statut des Factures</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={invoiceStatusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#4F46E5" name="Nombre" />
              <Bar dataKey="amount" fill="#10B981" name="Montant (€)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {metrics && metrics.overdueInvoices > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  <span className="font-medium">Attention!</span> Vous avez {metrics.overdueInvoices} facture(s) en retard.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Actions Rapides</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Créer une Facture
            </button>
            <button className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Envoyer des Rappels
            </button>
            <button className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              Voir Tous les Paiements
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: string;
  trendUp?: boolean;
  icon: string;
}

function MetricCard({ title, value, subtitle, trend, trendUp, icon }: MetricCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {trend && (
          <span className={`text-sm font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
