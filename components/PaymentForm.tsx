'use client';

import React, { useState } from 'react';
import { Invoice, PaymentMethod } from '@/types/invoice.types';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface PaymentFormProps {
  invoice: Invoice;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PaymentForm({ invoice, onSuccess, onCancel }: PaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<'stripe' | 'paypal' | 'wise'>('stripe');
  const [paymentMethodType, setPaymentMethodType] = useState<'card' | 'bank_account' | 'sepa'>('card');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const paymentMethod = {
        id: `pm_${Date.now()}`,
        userId: invoice.userId,
        type: paymentMethodType,
        provider: provider,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any as PaymentMethod;

      const response = await fetch('/api/billing/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          userId: invoice.userId,
          amount: invoice.total,
          currency: invoice.currency,
          paymentMethod,
          provider
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Payment failed');
      }

      const result = await response.json();
      
      if (result.success) {
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(result.message || 'Payment failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  return (
    <Card className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Pay Invoice</h2>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Invoice Number:</span>
          <span className="font-semibold">{invoice.number}</span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-gray-600">Amount Due:</span>
          <span className="text-2xl font-bold text-blue-600">
            {formatCurrency(invoice.total, invoice.currency)}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Provider
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'stripe' | 'paypal' | 'wise')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          >
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
            <option value="wise">Wise</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Method
          </label>
          <select
            value={paymentMethodType}
            onChange={(e) => setPaymentMethodType(e.target.value as 'card' | 'bank_account' | 'sepa')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          >
            <option value="card">Credit/Debit Card</option>
            <option value="bank_account">Bank Account</option>
            <option value="sepa">SEPA Direct Debit</option>
          </select>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Processing...' : `Pay ${formatCurrency(invoice.total, invoice.currency)}`}
          </Button>
          {onCancel && (
            <Button
              type="button"
              onClick={onCancel}
              variant="outline"
              disabled={loading}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>

      <div className="mt-6 text-xs text-gray-500 text-center">
        <p>Your payment is secure and encrypted.</p>
        <p>You will receive a confirmation email after payment.</p>
      </div>
    </Card>
  );
}
