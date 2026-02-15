'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

export type AuthMode = 'required' | 'demo';
export type UserRole = 'admin' | 'service_manager' | 'helper';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  role: UserRole | null;
  helperId: string | null;
  authMode: AuthMode;
  getIdToken: () => Promise<string | null>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  role: null,
  helperId: null,
  authMode: 'demo',
  getIdToken: async () => null,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthRole() {
  const { role, helperId } = useAuth();
  const hasNoRole = role === null;
  return {
    role,
    hasNoRole,
    isAdmin: role === 'admin',
    isServiceManager: role === 'service_manager',
    isHelper: role === 'helper',
    isManagerOrAbove: role === 'admin' || role === 'service_manager',
    /** 利用者マスタ編集可: admin + service_manager + デモモード */
    canEditCustomers: hasNoRole || role === 'admin' || role === 'service_manager',
    /** ヘルパーマスタ編集可: admin + デモモード */
    canEditHelpers: hasNoRole || role === 'admin',
    /** 希望休管理可: admin + service_manager + デモモード（helperは自分のみ） */
    canEditUnavailability: hasNoRole || role === 'admin' || role === 'service_manager',
    helperId,
  };
}

const AUTH_MODE: AuthMode =
  (process.env.NEXT_PUBLIC_AUTH_MODE as AuthMode) ?? 'demo';

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [helperId, setHelperId] = useState<string | null>(null);

  // Custom Claims からロール情報を取得
  const fetchClaims = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setRole(null);
      setHelperId(null);
      return;
    }
    try {
      const result = await firebaseUser.getIdTokenResult();
      const claims = result.claims;
      setRole((claims.role as UserRole) ?? null);
      setHelperId((claims.helper_id as string) ?? null);
    } catch {
      setRole(null);
      setHelperId(null);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      setUser(firebaseUser);
      await fetchClaims(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, [fetchClaims]);

  // デモモード: 未認証なら匿名サインイン
  useEffect(() => {
    if (AUTH_MODE === 'demo' && !loading && !user) {
      signInAnonymously(getFirebaseAuth()).catch(console.error);
    }
  }, [loading, user]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    return user.getIdToken();
  }, [user]);

  const signIn = useCallback(async () => {
    await signInWithPopup(getFirebaseAuth(), googleProvider);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
  }, []);

  // requiredモードで未認証 → Googleログイン画面
  if (AUTH_MODE === 'required' && !loading && !user) {
    return <LoginScreen onSignIn={signIn} />;
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
    <AuthContext.Provider value={{ user, loading, role, helperId, authMode: AUTH_MODE, getIdToken, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function LoginScreen({ onSignIn }: { onSignIn: () => Promise<void> }) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await onSignIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ログインに失敗しました');
      setSigningIn(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-[oklch(0.97_0.01_195)] to-[oklch(0.93_0.03_195)]">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-[oklch(0.45_0.10_210)]">
            <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">VisitCare</h1>
          <p className="text-sm text-gray-500">シフト最適化システム</p>
        </div>

        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {signingIn ? 'ログイン中...' : 'Google でログイン'}
        </button>

        {error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}

        <p className="text-center text-xs text-gray-400">
          組織の Google アカウントでログインしてください
        </p>
      </div>
    </div>
  );
}
