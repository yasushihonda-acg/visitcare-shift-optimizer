import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthProvider';

// Firebase authモック
const mockOnAuthStateChanged = vi.fn();
const mockSignInAnonymously = vi.fn();

vi.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => ({}),
  getDb: () => ({}),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
  getAuth: vi.fn(),
  connectAuthEmulator: vi.fn(),
}));

function TestConsumer() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  if (!user) return <div>no-user</div>;
  return <div>user:{user.uid}</div>;
}

beforeEach(() => {
  mockOnAuthStateChanged.mockReset();
  mockSignInAnonymously.mockReset();
});

describe('AuthProvider', () => {
  it('ローディング中を表示', () => {
    mockOnAuthStateChanged.mockImplementation(() => () => {});

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByText('認証中...')).toBeDefined();
  });

  it('認証済みユーザーのコンテキスト提供', async () => {
    const mockUser = { uid: 'test-uid', getIdToken: () => Promise.resolve('token') };
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback(mockUser);
      return () => {};
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('user:test-uid')).toBeDefined();
    });
  });

  it('デモモードで未認証時に匿名サインイン', async () => {
    // onAuthStateChangedで null を返す（未認証）
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return () => {};
    });
    mockSignInAnonymously.mockResolvedValue({ user: { uid: 'anon' } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockSignInAnonymously).toHaveBeenCalled();
    });
  });
});
