import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { AuthService } from '../services/AuthService';

  interface AuthContextType {
    user: any;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    requestSeller: () => Promise<void>;
    requestBroker: () => Promise<void>;
    requestLogistics: () => Promise<void>;
    verifyPhone: (code: string) => Promise<void>;
    sendPhoneOtp: () => Promise<void>;
    deleteAccount: () => Promise<void>;
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
        if (userData && userData.localId) {
          // Fetch full profile from backend
          const backendUser = await AuthService.getBackendUser(userData.localId);
          setUser({ ...userData, ...backendUser });
        } else if (userData) {
           setUser(userData);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    const refreshUser = async () => {
        if (user && user.localId) {
            const backendUser = await AuthService.getBackendUser(user.localId);
            const updatedUser = { ...user, ...backendUser };
            setUser(updatedUser);
        }
    };

    const login = async (email: string, password: string) => {
      const data = await AuthService.signIn(email, password);
      let userData = { email: data.email, localId: data.localId };
      
      // Get backend profile
      const backendUser = await AuthService.getBackendUser(data.localId);
      if (backendUser) {
          userData = { ...userData, ...backendUser };
      }

      await AuthService.saveToken(data.idToken, userData);
      setUser(userData);
    };

    const signup = async (email: string, password: string) => {
      const data = await AuthService.signUp(email, password);
      const userData = { email: data.email, localId: data.localId };
      
      // Create backend user
      await AuthService.createBackendUser(data.localId, data.email);

      await AuthService.saveToken(data.idToken, userData);
      setUser(userData);
    };

    const logout = async () => {
      await AuthService.logout();
      setUser(null);
    };

    const requestSeller = async () => {
      if (user && user.localId) {
        await AuthService.requestSellerStatus(user.localId);
        await refreshUser();
      }
    };

    const requestBroker = async () => {
      if (user && user.localId) {
        await AuthService.requestBrokerStatus(user.localId);
        await refreshUser();
      }
    };

    const requestLogistics = async () => {
      if (user && user.localId) {
        await AuthService.requestLogisticsStatus(user.localId);
        await refreshUser();
      }
    };

    const sendPhoneOtp = async () => {
      if (!user?.phoneNumber || !user?.localId) return;
      const phoneNumber = user.phoneNumber.startsWith('+') ? user.phoneNumber : `+${user.phoneNumber.replace(/\s/g, '')}`;
      await AuthService.sendOtp(phoneNumber);
    };

    const verifyPhone = async (code: string) => {
      if (!user?.phoneNumber || !user?.localId) return;
      await AuthService.verifyOtp(user.phoneNumber, code, user.localId);
      await refreshUser();
    };

    const deleteAccount = async () => {
        if (user && user.localId) {
            const token = await AuthService.getToken();
            if (token) {
                await AuthService.deleteAccount(token, user.localId);
                await logout();
            }
        }
    };

    return (
      <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser, requestSeller, requestBroker, requestLogistics, sendPhoneOtp, verifyPhone, deleteAccount }}>
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

