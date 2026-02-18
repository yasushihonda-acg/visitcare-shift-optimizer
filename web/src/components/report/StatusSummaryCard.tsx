'use client';

import { CircleCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { StatusSummary } from '@/lib/report/aggregation';

interface StatusSummaryCardProps {
  summary: StatusSummary;
}

const STATUS_ITEMS = [
  { key: 'completed' as const, label: '実績確認済', colorClass: 'bg-sky-500/10 text-sky-700' },
  { key: 'assigned' as const, label: '割当済', colorClass: 'bg-emerald-500/10 text-emerald-700' },
  { key: 'pending' as const, label: '未割当', colorClass: 'bg-amber-500/10 text-amber-700' },
  { key: 'cancelled' as const, label: 'キャンセル', colorClass: 'bg-red-500/10 text-red-700' },
];

export function StatusSummaryCard({ summary }: StatusSummaryCardProps) {
  return (
    <section className="rounded-xl border bg-card shadow-brand-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10">
          <CircleCheck className="h-4 w-4 text-sky-600" />
        </div>
        <h2 className="text-sm font-semibold">実績確認ステータス</h2>
        <span className="ml-auto text-xs text-muted-foreground">合計 {summary.total}件</span>
      </div>

      <div className="space-y-3 px-4 py-4">
        {/* 完了率プログレスバー */}
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">実績確認率（キャンセル除く）</span>
            <span className="text-sm font-bold">{summary.completionRate}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-500"
              style={{ width: `${summary.completionRate}%` }}
            />
          </div>
        </div>

        {/* ステータス別内訳 */}
        <div className="grid grid-cols-2 gap-2">
          {STATUS_ITEMS.map(({ key, label, colorClass }) => (
            <div
              key={key}
              className={`flex items-center justify-between rounded-lg px-3 py-2 ${colorClass}`}
            >
              <span className="text-xs font-medium">{label}</span>
              <Badge variant="outline" className="border-current bg-transparent text-current font-bold">
                {summary[key]}件
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
