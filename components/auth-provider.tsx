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

  useEffect(() => {
    // Vérifier si un utilisateur est déjà connecté au chargement
    const savedUser = localStorage.getItem('twinmcp_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        apiClient.setApiKey(parsedUser.apiKey || '');
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('twinmcp_user');
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
        localStorage.setItem('twinmcp_user', JSON.stringify(userData));
        apiClient.setApiKey(userData.apiKey);
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
    localStorage.removeItem('twinmcp_user');
    apiClient.clearApiKey();
  };

  const setApiKey = (apiKey: string) => {
    if (user) {
      const updatedUser = { ...user, apiKey };
      setUser(updatedUser);
      localStorage.setItem('twinmcp_user', JSON.stringify(updatedUser));
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
