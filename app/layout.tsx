import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
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
      <head>
        <Script
          src="https://www.google.com/recaptcha/enterprise.js?render=6LenTfIrAAAAANlD2F8YQawKA2-PtM8iDjpM2MH4"
          strategy="beforeInteractive"
        />
        <Script id="recaptcha-callback" strategy="afterInteractive">
          {`
            window.recaptchaToken = '';

            function onRecaptchaSubmit(token) {
              window.recaptchaToken = token;
              // Inject the token into the hidden input so client code can read it.
              const tokenInput = document.getElementById('recaptcha-token');
              if (tokenInput) {
                tokenInput.value = token;
              }
              // Do NOT programmatically submit the form here. The client's onSubmit
              // handler is responsible for reading the token and performing the
              // fetch/navigation flow to avoid full page reloads.
            }
          `}
        </Script>
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
