import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler, storage } from '../services/api';
import { clearUserCache } from '../services/queryClient';

export interface UserProfile {
  id: string;
  phone: string;
  name?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sendOtp: (phone: string) => Promise<{
    success: boolean;
    cooldownSeconds?: number;
    message?: string;
    isMockDelivery?: boolean;
    provider?: string;
    error?: string;
  }>;
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = () => {
    storage.clear();
    clearUserCache();
    setToken(null);
    setUser(null);
  };

  // Wire 401 interceptor to auto-logout
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, []);

  // Initialize auth state from storage on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = storage.getToken();
        const storedUser = storage.getUser();

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);

          // Verify token in background
          const verifyRes = await api.getMe();
          if (verifyRes.success && verifyRes.data?.user) {
            setUser(verifyRes.data.user);
            storage.setUser(verifyRes.data.user);
          } else if (verifyRes.error && verifyRes.error.includes('expired')) {
            logout();
          }
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const sendOtp = async (phone: string) => {
    const res = await api.sendOtp(phone);
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to send OTP' };
    }
    return {
      success: true,
      cooldownSeconds: res.data?.cooldownSeconds || 30,
      message: res.data?.message || 'OTP sent successfully',
      isMockDelivery: res.data?.isMockDelivery,
      provider: res.data?.provider,
    };
  };

  const verifyOtp = async (phone: string, otp: string, name?: string) => {
    const res = await api.verifyOtp(phone, otp, name);
    if (!res.success || !res.data) {
      return { success: false, error: res.error || 'Verification failed' };
    }

    const { token: newToken, user: newUser } = res.data;
    storage.setToken(newToken);
    storage.setUser(newUser);
    setToken(newToken);
    setUser(newUser);

    return { success: true };
  };

  const refreshUser = async () => {
    const res = await api.getMe();
    if (res.success && res.data?.user) {
      setUser(res.data.user);
      storage.setUser(res.data.user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        sendOtp,
        verifyOtp,
        logout,
        refreshUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
