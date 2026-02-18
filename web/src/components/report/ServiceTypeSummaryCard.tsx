'use client';

import { ClipboardList } from 'lucide-react';
import { formatMinutesToHours } from '@/lib/report/aggregation';
import type { ServiceTypeSummaryItem } from '@/lib/report/aggregation';

interface ServiceTypeSummaryCardProps {
  items: ServiceTypeSummaryItem[];
  totalMinutes: number;
}

const SERVICE_TYPE_COLORS: Record<string, string> = {
  physical_care: 'bg-violet-500',
  daily_living: 'bg-teal-500',
};

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
            const barColor = SERVICE_TYPE_COLORS[item.serviceType] ?? 'bg-gray-400';
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
