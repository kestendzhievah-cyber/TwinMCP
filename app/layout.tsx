import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'UCP Commerce — Référencement LLM pour E-commerce',
  description: 'Optimisez la visibilité de vos produits sur ChatGPT, Claude, Gemini et les moteurs de réponse IA grâce au protocole UCP (Unified Context Protocol).',
  keywords: ['UCP', 'e-commerce', 'LLM', 'SEO', 'référencement IA', 'ChatGPT', 'commerce'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <body className={`${inter.className} min-h-screen bg-background antialiased`}>
        {children}
      </body>
    </html>
  );
}
