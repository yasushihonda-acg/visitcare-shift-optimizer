'use client';

import { AuthProvider } from '@/lib/auth/AuthProvider';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
