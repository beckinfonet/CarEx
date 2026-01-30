import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { AuthService } from '../services/AuthService';

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email, password) => Promise<void>;
  signup: (email, password) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStorageData();
  }, []);

  const loadStorageData = async () => {
    try {
      const userData = await AuthService.getUserData();
      if (userData) {
        setUser(userData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const data = await AuthService.signIn(email, password);
    const userData = { email: data.email, localId: data.localId };
    await AuthService.saveToken(data.idToken, userData);
    setUser(userData);
  };

  const signup = async (email, password) => {
    const data = await AuthService.signUp(email, password);
    const userData = { email: data.email, localId: data.localId };
    await AuthService.saveToken(data.idToken, userData);
    setUser(userData);
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

