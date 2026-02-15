import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth, useAuthRole } from '../AuthProvider';

// Firebase authモック
const mockOnAuthStateChanged = vi.fn();
const mockSignInAnonymously = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => ({}),
  getDb: () => ({}),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  GoogleAuthProvider: vi.fn(),
  getAuth: vi.fn(),
  connectAuthEmulator: vi.fn(),
}));

function TestConsumer() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  if (!user) return <div>no-user</div>;
  return <div>user:{user.uid}</div>;
}

function TestRoleConsumer() {
  const { role, hasNoRole, isAdmin, isServiceManager, isHelper, isManagerOrAbove, canEditCustomers, canEditHelpers, canEditUnavailability, helperId } = useAuthRole();
  return (
    <div>
      <span data-testid="role">{role ?? 'none'}</span>
      <span data-testid="hasNoRole">{String(hasNoRole)}</span>
      <span data-testid="isAdmin">{String(isAdmin)}</span>
      <span data-testid="isServiceManager">{String(isServiceManager)}</span>
      <span data-testid="isHelper">{String(isHelper)}</span>
      <span data-testid="isManagerOrAbove">{String(isManagerOrAbove)}</span>
      <span data-testid="canEditCustomers">{String(canEditCustomers)}</span>
      <span data-testid="canEditHelpers">{String(canEditHelpers)}</span>
      <span data-testid="canEditUnavailability">{String(canEditUnavailability)}</span>
      <span data-testid="helperId">{helperId ?? 'none'}</span>
    </div>
  );
}

function TestSignOutConsumer() {
  const { user, signOut } = useAuth();
  return (
    <div>
      {user && <span>user:{user.uid}</span>}
      <button onClick={signOut}>ログアウト</button>
    </div>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
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
    const mockUser = {
      uid: 'test-uid',
      getIdToken: () => Promise.resolve('token'),
      getIdTokenResult: () => Promise.resolve({ claims: {} }),
    };
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

  it('signOut を呼び出せる', async () => {
    const mockUser = {
      uid: 'test-uid',
      getIdToken: () => Promise.resolve('token'),
      getIdTokenResult: () => Promise.resolve({ claims: {} }),
    };
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback(mockUser);
      return () => {};
    });
    mockSignOut.mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <TestSignOutConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('user:test-uid')).toBeDefined();
    });

    fireEvent.click(screen.getByText('ログアウト'));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});

describe('useAuthRole', () => {
  it('Custom Claims からロール情報を取得（admin）', async () => {
    const mockUser = {
      uid: 'admin-uid',
      getIdToken: () => Promise.resolve('token'),
      getIdTokenResult: () => Promise.resolve({
        claims: { role: 'admin' },
      }),
    };
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback(mockUser);
      return () => {};
    });

    render(
      <AuthProvider>
        <TestRoleConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('role').textContent).toBe('admin');
      expect(screen.getByTestId('isAdmin').textContent).toBe('true');
      expect(screen.getByTestId('isManagerOrAbove').textContent).toBe('true');
      expect(screen.getByTestId('canEditCustomers').textContent).toBe('true');
      expect(screen.getByTestId('canEditHelpers').textContent).toBe('true');
      expect(screen.getByTestId('canEditUnavailability').textContent).toBe('true');
    });
  });

  it('Custom Claims からロール情報を取得（service_manager）', async () => {
    const mockUser = {
      uid: 'manager-uid',
      getIdToken: () => Promise.resolve('token'),
      getIdTokenResult: () => Promise.resolve({
        claims: { role: 'service_manager' },
      }),
    };
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback(mockUser);
      return () => {};
    });

    render(
      <AuthProvider>
        <TestRoleConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('role').textContent).toBe('service_manager');
      expect(screen.getByTestId('isServiceManager').textContent).toBe('true');
      expect(screen.getByTestId('isManagerOrAbove').textContent).toBe('true');
      expect(screen.getByTestId('canEditCustomers').textContent).toBe('true');
      expect(screen.getByTestId('canEditHelpers').textContent).toBe('false');
      expect(screen.getByTestId('canEditUnavailability').textContent).toBe('true');
    });
  });

  it('Custom Claims からロール情報を取得（helper + helper_id）', async () => {
    const mockUser = {
      uid: 'helper-uid',
      getIdToken: () => Promise.resolve('token'),
      getIdTokenResult: () => Promise.resolve({
        claims: { role: 'helper', helper_id: 'helper-001' },
      }),
    };
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback(mockUser);
      return () => {};
    });

    render(
      <AuthProvider>
        <TestRoleConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('role').textContent).toBe('helper');
      expect(screen.getByTestId('isHelper').textContent).toBe('true');
      expect(screen.getByTestId('isManagerOrAbove').textContent).toBe('false');
      expect(screen.getByTestId('canEditCustomers').textContent).toBe('false');
      expect(screen.getByTestId('canEditHelpers').textContent).toBe('false');
      expect(screen.getByTestId('canEditUnavailability').textContent).toBe('false');
      expect(screen.getByTestId('helperId').textContent).toBe('helper-001');
    });
  });

  it('Custom Claims がない場合は role が null', async () => {
    const mockUser = {
      uid: 'anon-uid',
      getIdToken: () => Promise.resolve('token'),
      getIdTokenResult: () => Promise.resolve({ claims: {} }),
    };
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback(mockUser);
      return () => {};
    });

    render(
      <AuthProvider>
        <TestRoleConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('role').textContent).toBe('none');
      expect(screen.getByTestId('hasNoRole').textContent).toBe('true');
      expect(screen.getByTestId('isAdmin').textContent).toBe('false');
      expect(screen.getByTestId('isManagerOrAbove').textContent).toBe('false');
      expect(screen.getByTestId('canEditCustomers').textContent).toBe('true');
      expect(screen.getByTestId('canEditHelpers').textContent).toBe('true');
      expect(screen.getByTestId('canEditUnavailability').textContent).toBe('true');
    });
  });
});
