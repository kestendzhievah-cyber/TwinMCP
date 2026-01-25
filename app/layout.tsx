import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SpeedInsights } from "@vercel/speed-insights/next"
import './globals.css'
import { AuthProvider } from '../lib/auth-context'
import { StripeProvider } from '../components/StripeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgentFlow - Plateforme SaaS pour Agents IA',
  description: 'Créez, gérez et optimisez des agents d\'intelligence artificielle personnalisés avec AgentFlow',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <StripeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </StripeProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
