'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

interface ProtectedRouteProps {
  children: React.ReactNode
  redirectTo?: string
}

export default function ProtectedRoute({
  children,
  redirectTo = '/login'
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push(redirectTo)
    }
  }, [user, loading, router, redirectTo])

  // Afficher un loader stylé pendant la vérification de l'authentification
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Vérification de l'authentification...</p>
        </div>
      </div>
    )
  }

  // Rediriger si l'utilisateur n'est pas connecté
  if (!user) {
    return null
  }

  // Rendre le contenu protégé si l'utilisateur est connecté
  return <>{children}</>
}

// Composant optionnel pour afficher du contenu uniquement aux utilisateurs connectés
export function AuthenticatedContent({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return <>{children}</>
}

// Composant pour afficher du contenu uniquement aux utilisateurs non connectés
export function UnauthenticatedContent({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  if (user) {
    return null
  }

  return <>{children}</>
}
