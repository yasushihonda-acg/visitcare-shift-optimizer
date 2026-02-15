'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MASTER_TABS = [
  { value: '/masters/customers', label: '利用者マスタ' },
  { value: '/masters/helpers', label: 'ヘルパーマスタ' },
  { value: '/masters/unavailability', label: '希望休管理' },
] as const;

export default function MastersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentTab = MASTER_TABS.find((t) => pathname.startsWith(t.value))?.value ?? MASTER_TABS[0].value;

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="border-b px-4 pt-2">
        <Tabs value={currentTab}>
          <TabsList>
            {MASTER_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} asChild>
                <Link href={tab.value}>{tab.label}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
