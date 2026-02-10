'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

type AuthMode = 'required' | 'demo';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  getIdToken: async () => null,
});

export function useAuth() {
  return useContext(AuthContext);
}

const AUTH_MODE: AuthMode =
  (process.env.NEXT_PUBLIC_AUTH_MODE as AuthMode) ?? 'demo';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // デモモード: 未認証なら匿名サインイン
  useEffect(() => {
    if (AUTH_MODE === 'demo' && !loading && !user) {
      signInAnonymously(getFirebaseAuth()).catch(console.error);
    }
  }, [loading, user]);

  const getIdToken = async (): Promise<string | null> => {
    if (!user) return null;
    return user.getIdToken();
  };

  // requiredモードで未認証 → ログインUI表示
  if (AUTH_MODE === 'required' && !loading && !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">VisitCare シフト最適化</h1>
          <p className="text-muted-foreground">ログインが必要です</p>
          <p className="text-sm text-muted-foreground">
            管理者にアカウントの発行を依頼してください
          </p>
        </div>
      </div>
    );
  }

  // ローディング中
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">認証中...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}
