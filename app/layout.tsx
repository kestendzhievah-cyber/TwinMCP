import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SpeedInsights } from "@vercel/speed-insights/next"
import './globals.css'
import { AuthProvider } from '../lib/auth-context'
import { StripeProvider } from '../components/StripeProvider'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
})

export const metadata: Metadata = {
  title: 'TwinMCP - Plateforme SaaS pour Agents IA',
  description: 'Créez, gérez et optimisez des agents d\'intelligence artificielle personnalisés avec TwinMCP',
  other: {
    'theme-color': '#0a0118',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
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
