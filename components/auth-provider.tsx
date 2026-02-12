"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/lib/client/api-client';

interface User {
  id: string;
  email: string;
  name?: string;
  apiKey?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  setApiKey: (apiKey: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Vérifier si un utilisateur est déjà connecté au chargement
    if (typeof window !== 'undefined') {
      try {
        const savedUser = localStorage.getItem('twinmcp_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          apiClient.setApiKey(parsedUser.apiKey || '');
        }
      } catch (error) {
        console.error('Error parsing saved user:', error);
        try {
          localStorage.removeItem('twinmcp_user');
        } catch {
          // Ignore
        }
      }
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      // Simulation d'authentification (à remplacer par un vrai appel API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulation de validation
      if (email === 'admin@twinmcp.com' && password === 'admin123') {
        const userData: User = {
          id: '1',
          email: 'admin@twinmcp.com',
          name: 'TwinMCP Admin',
          apiKey: 'twinmcp_live_test123' // Clé de test
        };
        
        setUser(userData);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('twinmcp_user', JSON.stringify(userData));
          } catch {
            // Ignore
          }
        }
        apiClient.setApiKey(userData.apiKey || '');
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('twinmcp_user');
      } catch {
        // Ignore
      }
    }
    apiClient.clearApiKey();
  };

  const setApiKey = (apiKey: string) => {
    if (user) {
      const updatedUser = { ...user, apiKey };
      setUser(updatedUser);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('twinmcp_user', JSON.stringify(updatedUser));
        } catch {
          // Ignore
        }
      }
      apiClient.setApiKey(apiKey);
    }
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    loading,
    setApiKey
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
