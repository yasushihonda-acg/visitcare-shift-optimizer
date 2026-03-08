'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Menu, Users, UserCog, CalendarOff, History, LogOut, HelpCircle, BarChart2, Tag, CalendarCheck, Bell, LayoutDashboard } from 'lucide-react';
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
    <header className="bg-gradient-to-r from-[oklch(0.50_0.13_200)] to-[oklch(0.56_0.14_188)] px-4 py-3 shadow-brand">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
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
                <Menu className="h-4.5 w-4.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/" className={pathname === '/' ? 'bg-accent' : ''}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  スケジュール
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>マスタ管理</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/masters/customers" className={pathname?.startsWith('/masters/customers') ? 'bg-accent' : ''}>
                  <Users className="mr-2 h-4 w-4" />
                  利用者
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/masters/helpers" className={pathname?.startsWith('/masters/helpers') ? 'bg-accent' : ''}>
                  <UserCog className="mr-2 h-4 w-4" />
                  ヘルパー
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/masters/service-types" className={pathname?.startsWith('/masters/service-types') ? 'bg-accent' : ''}>
                  <Tag className="mr-2 h-4 w-4" />
                  サービス種別
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/masters/weekly-schedule" className={pathname?.startsWith('/masters/weekly-schedule') ? 'bg-accent' : ''}>
                  <CalendarCheck className="mr-2 h-4 w-4" />
                  基本予定
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/masters/unavailability" className={pathname?.startsWith('/masters/unavailability') ? 'bg-accent' : ''}>
                  <CalendarOff className="mr-2 h-4 w-4" />
                  希望休
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>運用</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/history" className={pathname?.startsWith('/history') ? 'bg-accent' : ''}>
                  <History className="mr-2 h-4 w-4" />
                  実行履歴
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/report" className={pathname?.startsWith('/report') ? 'bg-accent' : ''}>
                  <BarChart2 className="mr-2 h-4 w-4" />
                  月次レポート
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>設定</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/settings" className={pathname?.startsWith('/settings') ? 'bg-accent' : ''}>
                  <Bell className="mr-2 h-4 w-4" />
                  通知設定
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
