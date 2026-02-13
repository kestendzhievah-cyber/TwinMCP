'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { 
  auth, 
  setAuthPersistence, 
  saveRememberMePreference, 
  clearRememberMePreference,
  getRememberMePreference,
  isFirebaseReady 
} from './firebase'

// Extended user profile from backend
export interface UserProfile {
  id: string
  email: string
  name: string | null
  avatar: string | null
  role: string
  plan: string
  clientId: string
  profile: {
    firstName: string | null
    lastName: string | null
    phone: string | null
    address: string | null
    city: string | null
    country: string | null
  } | null
  subscription: {
    plan: string
    status: string
    currentPeriodEnd: Date | null
  } | null
  stats: {
    apiKeysCount: number
    requestsToday: number
    requestsMonth: number
  }
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  profileLoading: boolean
  rememberMe: boolean
  firebaseReady: boolean
  setRememberMe: (value: boolean) => void
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: (rememberMe?: boolean) => Promise<void>
  signInWithGithub: (rememberMe?: boolean) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (data: Partial<UserProfile['profile']>) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [rememberMe, setRememberMeState] = useState(false)
  const [firebaseReady, setFirebaseReady] = useState(false)

  // Check if Firebase is ready on mount
  useEffect(() => {
    setFirebaseReady(isFirebaseReady())
  }, [])

  // Initialize rememberMe from localStorage
  useEffect(() => {
    const saved = getRememberMePreference()
    setRememberMeState(saved)
  }, [])

  // Wrapper to update rememberMe state and localStorage
  const setRememberMe = useCallback((value: boolean) => {
    setRememberMeState(value)
    saveRememberMePreference(value)
  }, [])

  /**
   * Verify token with backend and sync user
   */
  const syncUserWithBackend = useCallback(async (firebaseUser: User) => {
    try {
      setProfileLoading(true)
      const idToken = await firebaseUser.getIdToken()
      
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      })

      const result = await response.json()

      if (result.success && result.data?.user) {
        setProfile(result.data.user)
      } else {
        console.warn('[Auth] Backend verification failed:', result.error)
        // Create minimal profile from Firebase user
        setProfile({
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName,
          avatar: firebaseUser.photoURL,
          role: 'BUYER',
          plan: 'free',
          clientId: '',
          profile: null,
          subscription: null,
          stats: { apiKeysCount: 0, requestsToday: 0, requestsMonth: 0 }
        })
      }
    } catch (error) {
      console.error('[Auth] Sync error:', error)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  /**
   * Refresh user profile from backend
   */
  const refreshProfile = useCallback(async () => {
    if (!user) return

    try {
      setProfileLoading(true)
      const idToken = await user.getIdToken()
      
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      })

      const result = await response.json()

      if (result.success && result.data?.user) {
        setProfile(result.data.user)
      }
    } catch (error) {
      console.error('[Auth] Refresh profile error:', error)
    } finally {
      setProfileLoading(false)
    }
  }, [user])

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (data: Partial<UserProfile['profile']>): Promise<boolean> => {
    if (!user) return false

    try {
      const idToken = await user.getIdToken()
      
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (result.success) {
        // Refresh profile to get updated data
        await refreshProfile()
        return true
      }
      
      return false
    } catch (error) {
      console.error('[Auth] Update profile error:', error)
      return false
    }
  }, [user, refreshProfile])

  useEffect(() => {
    // If Firebase is not ready, just set loading to false
    if (!auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      
      // Set loading to false immediately — we know if user exists or not
      // Profile sync happens in background via profileLoading
      setLoading(false)

      if (firebaseUser) {
        // Sync with backend in background (non-blocking)
        syncUserWithBackend(firebaseUser)
      } else {
        setProfile(null)
      }
    })

    return unsubscribe
  }, [syncUserWithBackend])

  /**
   * Sign in with email and password
   */
  const signIn = async (email: string, password: string, remember?: boolean) => {
    if (!auth) {
      throw new Error('Firebase non initialisé. Veuillez configurer Firebase.')
    }
    
    const shouldRemember = remember !== undefined ? remember : rememberMe
    
    // Set persistence before signing in
    await setAuthPersistence(shouldRemember)
    saveRememberMePreference(shouldRemember)
    
    await signInWithEmailAndPassword(auth, email, password)
    // Sync will happen automatically via onAuthStateChanged
  }

  /**
   * Sign up with email and password
   */
  const signUp = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase non initialisé. Veuillez configurer Firebase.')
    }
    
    // Always use local persistence for new accounts
    await setAuthPersistence(true)
    saveRememberMePreference(true)
    
    await createUserWithEmailAndPassword(auth, email, password)
  }

  /**
   * Sign in with Google
   */
  const signInWithGoogle = async (remember?: boolean) => {
    if (!auth) {
      throw new Error('Firebase non initialisé. Veuillez configurer Firebase.')
    }
    
    const shouldRemember = remember !== undefined ? remember : rememberMe
    
    // Set persistence before signing in
    await setAuthPersistence(shouldRemember)
    saveRememberMePreference(shouldRemember)
    
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  /**
   * Sign in with GitHub
   */
  const signInWithGithub = async (remember?: boolean) => {
    if (!auth) {
      throw new Error('Firebase non initialisé. Veuillez configurer Firebase.')
    }
    
    const shouldRemember = remember !== undefined ? remember : rememberMe
    
    // Set persistence before signing in
    await setAuthPersistence(shouldRemember)
    saveRememberMePreference(shouldRemember)
    
    const provider = new GithubAuthProvider()
    await signInWithPopup(auth, provider)
  }

  /**
   * Logout
   */
  const logout = async () => {
    // Logout from backend first
    if (user) {
      try {
        const idToken = await user.getIdToken()
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        })
      } catch (error) {
        console.warn('[Auth] Backend logout error:', error)
      }
    }
    
    // Clear remember me preference
    clearRememberMePreference()
    setRememberMeState(false)
    
    // Then logout from Firebase
    if (auth) {
      await signOut(auth)
    }
    setProfile(null)
  }

  const value = {
    user,
    profile,
    loading,
    profileLoading,
    rememberMe,
    firebaseReady,
    setRememberMe,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithGithub,
    logout,
    refreshProfile,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
