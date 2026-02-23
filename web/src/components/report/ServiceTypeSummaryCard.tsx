'use client';

import { ClipboardList } from 'lucide-react';
import { formatMinutesToHours } from '@/lib/report/aggregation';
import type { ServiceTypeSummaryItem } from '@/lib/report/aggregation';

interface ServiceTypeSummaryCardProps {
  items: ServiceTypeSummaryItem[];
  totalMinutes: number;
}

function getServiceBarColor(code: string): string {
  if (code.startsWith('通所介護Ⅰ')) return 'bg-blue-500';
  if (code.startsWith('地域密着型')) return 'bg-teal-500';
  if (code.startsWith('訪問看護')) return 'bg-purple-500';
  if (code.startsWith('大規模型Ⅰ')) return 'bg-red-500';
  return 'bg-orange-500'; // 訪問介護（身体介護・生活援助等）
}

export function ServiceTypeSummaryCard({ items, totalMinutes }: ServiceTypeSummaryCardProps) {
  return (
    <section className="rounded-xl border bg-card shadow-brand-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <ClipboardList className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-sm font-semibold">サービス種別内訳</h2>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">データなし</p>
      ) : (
        <div className="space-y-3 px-4 py-4">
          {items.map((item) => {
            const pct = totalMinutes > 0
              ? Math.round((item.totalMinutes / totalMinutes) * 100)
              : 0;
            const barColor = getServiceBarColor(item.serviceType);
            return (
              <div key={item.serviceType}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">{item.label}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.visitCount}件</span>
                    <span>{formatMinutesToHours(item.totalMinutes)}</span>
                    <span className="font-bold text-foreground">{pct}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
