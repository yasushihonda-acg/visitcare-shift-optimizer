'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface BreadcrumbEntry {
  group: string;
  groupHref?: string;
  label: string;
}

const BREADCRUMB_MAP: Record<string, BreadcrumbEntry> = {
  '/masters/customers': { group: 'マスタ管理', groupHref: '/masters/customers', label: '利用者' },
  '/masters/helpers': { group: 'マスタ管理', groupHref: '/masters/customers', label: 'ヘルパー' },
  '/masters/service-types': { group: 'マスタ管理', groupHref: '/masters/customers', label: 'サービス種別' },
  '/masters/weekly-schedule': { group: 'マスタ管理', groupHref: '/masters/customers', label: '基本予定' },
  '/masters/unavailability': { group: 'マスタ管理', groupHref: '/masters/customers', label: '希望休' },
  '/history': { group: '運用', label: '実行履歴' },
  '/report': { group: '運用', label: '月次レポート' },
  '/settings': { group: '設定', label: '通知設定' },
};

export function AppBreadcrumb() {
  const rawPathname = usePathname();
  // trailingSlash: true の場合 /history/ → /history に正規化
  const pathname = rawPathname?.replace(/\/$/, '') || null;
  const entry = pathname ? BREADCRUMB_MAP[pathname] : undefined;

  if (!entry) return null;

  return (
    <div className="border-b bg-muted/30 px-4 py-1.5">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">ホーム</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {entry.groupHref ? (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={entry.groupHref}>{entry.group}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          ) : (
            <>
              <BreadcrumbItem>
                <span className="text-muted-foreground">{entry.group}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{entry.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
