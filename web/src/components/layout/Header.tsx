'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Settings, Users, UserCog, CalendarOff, History, LogOut, HelpCircle } from 'lucide-react';
import { WeekSelector } from '@/components/schedule/WeekSelector';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const ROLE_LABELS: Record<string, string> = {
  admin: '管理者',
  service_manager: 'サ責',
  helper: 'ヘルパー',
};

interface HeaderProps {
  onShowWelcome?: () => void;
}

export function Header({ onShowWelcome }: HeaderProps = {}) {
  const pathname = usePathname();
  const isMasterPage = pathname?.startsWith('/masters');
  const isSchedulePage = pathname === '/' || pathname === '';
  const { user, role, authMode, signOut } = useAuth();

  const isLoggedIn = authMode === 'required' && user && !user.isAnonymous;

  return (
    <header className="bg-gradient-to-r from-primary to-[oklch(0.45_0.10_210)] px-4 py-3 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
              <Heart className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">
                VisitCare
              </h1>
              <p className="text-[10px] text-white/70 leading-none">
                シフト最適化
              </p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {isSchedulePage && <WeekSelector variant="header" />}

          {isLoggedIn && (
            <div className="flex items-center gap-1.5 mr-1">
              {role && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
                  {ROLE_LABELS[role] ?? role}
                </span>
              )}
              <span className="text-xs text-white/80 hidden sm:inline">
                {user.displayName ?? user.email}
              </span>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/15"
              >
                <Settings className="h-4.5 w-4.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>マスタ管理</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/masters/customers">
                  <Users className="mr-2 h-4 w-4" />
                  利用者マスタ
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/masters/helpers">
                  <UserCog className="mr-2 h-4 w-4" />
                  ヘルパーマスタ
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/masters/unavailability">
                  <CalendarOff className="mr-2 h-4 w-4" />
                  希望休管理
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>最適化</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/history">
                  <History className="mr-2 h-4 w-4" />
                  実行履歴
                </Link>
              </DropdownMenuItem>
              {onShowWelcome && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onShowWelcome}>
                    <HelpCircle className="mr-2 h-4 w-4" />
                    使い方
                  </DropdownMenuItem>
                </>
              )}
              {isLoggedIn && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    ログアウト
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
