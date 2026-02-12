'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Invoice, Payment, Subscription, InvoiceStatus } from '../types/invoice.types';

interface BillingDashboardProps {
  userId: string;
}

export default function BillingDashboard({ userId }: BillingDashboardProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchBillingData();
  }, [userId]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      
      const [invoicesRes, paymentsRes, subscriptionsRes] = await Promise.all([
        fetch(`/api/billing/invoices?userId=${userId}`),
        fetch(`/api/billing/payments?userId=${userId}`),
        fetch(`/api/billing/subscriptions?userId=${userId}`)
      ]);

      const invoicesData = JSON.parse(await invoicesRes.text()) as {
        success?: boolean;
        data?: { invoices: Invoice[] };
      };
      const paymentsData = JSON.parse(await paymentsRes.text()) as {
        success?: boolean;
        data?: { payments: Payment[] };
      };
      const subscriptionsData = JSON.parse(await subscriptionsRes.text()) as {
        success?: boolean;
        data?: { subscriptions: Subscription[] };
      };

      if (invoicesRes.ok && invoicesData.success && invoicesData.data) {
        setInvoices(invoicesData.data.invoices);
      }
      if (paymentsRes.ok && paymentsData.success && paymentsData.data) {
        setPayments(paymentsData.data.payments);
      }
      if (subscriptionsRes.ok && subscriptionsData.success && subscriptionsData.data) {
        setSubscriptions(subscriptionsData.data.subscriptions);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'paid':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'sent':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number, currency = 'EUR') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('fr-FR');
  };

  const handleDownloadInvoice = (invoiceId: string) => {
    window.open(`/api/billing/invoices/${invoiceId}/pdf?userId=${userId}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Facturation</h1>
        <Button onClick={fetchBillingData}>Actualiser</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="invoices">Factures</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="subscriptions">Abonnements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Total des factures</CardTitle>
                <CardDescription>30 derniers jours</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    invoices
                      .filter(inv => inv.status === InvoiceStatus.PAID)
                      .reduce((sum, inv) => sum + inv.total, 0)
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Abonnements actifs</CardTitle>
                <CardDescription>Ce mois</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {subscriptions.filter(sub => sub.status === 'active').length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dépenses ce mois</CardTitle>
                <CardDescription>Total mensuel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(
                    subscriptions
                      .filter(sub => sub.status === 'active')
                      .reduce((sum, sub) => sum + sub.amount, 0)
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <div className="grid gap-4">
            {invoices.map((invoice) => (
              <Card key={invoice.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">Facture #{invoice.number}</h3>
                      <p className="text-sm text-gray-600">
                        {formatDate(invoice.createdAt)}
                      </p>
                      <p className="text-lg font-bold mt-2">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </p>
                    </div>
                    <div className="text-right space-y-2">
                      <Badge className={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                      <div className="space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadInvoice(invoice.id)}
                        >
                          Télécharger PDF
                        </Button>
                        {(invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.SENT) && (
                          <Button size="sm">
                            Payer
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div className="grid gap-4">
            {payments.map((payment) => (
              <Card key={payment.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">
                        Paiement #{payment.id.slice(-8)}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {formatDate(payment.createdAt)}
                      </p>
                      <p className="text-lg font-bold mt-2">
                        {formatCurrency(payment.amount, payment.currency)}
                      </p>
                      {payment.failureReason && (
                        <p className="text-sm text-red-600 mt-1">
                          {payment.failureReason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(payment.status)}>
                        {payment.status}
                      </Badge>
                      <p className="text-sm text-gray-600 mt-2">
                        {payment.provider}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="grid gap-4">
            {subscriptions.map((subscription) => (
              <Card key={subscription.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{subscription.plan}</h3>
                      <p className="text-sm text-gray-600">
                        {formatDate(subscription.currentPeriodStart)} - {' '}
                        {formatDate(subscription.currentPeriodEnd)}
                      </p>
                      <p className="text-lg font-bold mt-2">
                        {formatCurrency(subscription.amount, subscription.currency)}
                        <span className="text-sm font-normal text-gray-600">
                          /{subscription.interval === 'month' ? 'mois' : 'an'}
                        </span>
                      </p>
                    </div>
                    <div className="text-right space-y-2">
                      <Badge className={getStatusColor(subscription.status)}>
                        {subscription.status}
                      </Badge>
                      <div className="space-x-2">
                        <Button variant="outline" size="sm">
                          Modifier
                        </Button>
                        {subscription.status === 'active' && (
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleCancelSubscription(subscription.id)}
                          >
                            Annuler
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  function handleCancelSubscription(subscriptionId: string) {
    // Implementation for subscription cancellation
    console.log('Cancelling subscription:', subscriptionId);
  }
}
