'use client'

import { useState } from 'react'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

const PaymentForm = () => {
  const stripe = useStripe()
  const elements = useElements()
  const [amount, setAmount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setMessage('')

    try {
      // Create Payment Intent
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          description: 'Test payment for TwinMCP',
        }),
      })

      const { clientSecret } = await response.json()

      // Confirm Payment
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        },
      })

      if (error) {
        setMessage(error.message || 'Erreur de paiement')
      } else {
        setMessage('Paiement réussi !')
      }
    } catch (err) {
      setMessage('Erreur lors du paiement')
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Paiement avec Stripe</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Montant (€)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full p-2 border rounded"
          min="1"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Informations de carte
        </label>
        <div className="p-2 border rounded">
          <CardElement />
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Traitement...' : `Payer ${amount}€`}
      </button>

      {message && (
        <p className="mt-4 text-sm text-center text-gray-600">{message}</p>
      )}
    </form>
  )
}

export default PaymentForm
