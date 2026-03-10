'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { Violation, ViolationMap, ViolationSeverity } from '@/lib/constraints/checker';
import type { Customer, Helper } from '@/types';

const VIOLATION_TYPE_LABELS: Record<Violation['type'], string> = {
  ng_staff: 'NGスタッフ',
  qualification: '資格不適合',
  overlap: '時間重複',
  unavailability: '希望休',
  gender: '性別要件',
  training: '研修状態',
  preferred_staff: '推奨スタッフ外',
  staff_count_under: '人員不足',
  staff_count_over: '人員超過',
  outside_hours: '勤務時間外',
  travel_time: '移動時間不足',
};

type FilterMode = 'all' | ViolationSeverity;

interface ViolationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  violations: ViolationMap;
  customers: Map<string, Customer>;
  helpers: Map<string, Helper>;
  initialFilter?: FilterMode;
}

interface GroupedViolation {
  type: Violation['type'];
  label: string;
  items: Violation[];
}

function groupViolations(violations: Violation[]): GroupedViolation[] {
  const map = new Map<Violation['type'], Violation[]>();
  for (const v of violations) {
    const list = map.get(v.type) ?? [];
    list.push(v);
    map.set(v.type, list);
  }
  const result: GroupedViolation[] = [];
  for (const [type, items] of map) {
    result.push({ type, label: VIOLATION_TYPE_LABELS[type], items });
  }
  return result.sort((a, b) => b.items.length - a.items.length);
}

export function ViolationPanel({
  open,
  onOpenChange,
  violations,
  customers: _customers, // eslint-disable-line @typescript-eslint/no-unused-vars -- Phase 3 ナビゲーション連携で使用予定
  helpers: _helpers, // eslint-disable-line @typescript-eslint/no-unused-vars -- Phase 3 ナビゲーション連携で使用予定
  initialFilter = 'all',
}: ViolationPanelProps) {
  const [filter, setFilter] = useState<FilterMode>(initialFilter);

  // initialFilter が変わったら同期
  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const allViolations = useMemo(
    () => Array.from(violations.values()).flat(),
    [violations],
  );

  const errorCount = useMemo(
    () => allViolations.filter((v) => v.severity === 'error').length,
    [allViolations],
  );
  const warningCount = useMemo(
    () => allViolations.filter((v) => v.severity === 'warning').length,
    [allViolations],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return allViolations;
    return allViolations.filter((v) => v.severity === filter);
  }, [allViolations, filter]);

  const errorGroups = useMemo(
    () => groupViolations(filtered.filter((v) => v.severity === 'error')),
    [filtered],
  );
  const warningGroups = useMemo(
    () => groupViolations(filtered.filter((v) => v.severity === 'warning')),
    [filtered],
  );

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-96 sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-base">違反・警告一覧</SheetTitle>
          <SheetDescription className="sr-only">
            現在のスケジュールで検出された違反と警告の一覧です
          </SheetDescription>
        </SheetHeader>

        {/* フィルタボタン */}
        <div className="flex gap-1.5 px-4 py-2 border-b">
          <button
            type="button"
            aria-label="すべて"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            すべて ({allViolations.length})
          </button>
          <button
            type="button"
            aria-label="違反のみ"
            onClick={() => setFilter('error')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            違反 ({errorCount})
          </button>
          <button
            type="button"
            aria-label="警告のみ"
            onClick={() => setFilter('warning')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === 'warning'
                ? 'bg-yellow-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            警告 ({warningCount})
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mb-3 text-emerald-500" />
              <p className="text-sm font-medium">問題は検出されませんでした</p>
            </div>
          ) : (
            <div className="divide-y">
              {/* エラーセクション */}
              {errorGroups.length > 0 && (
                <section className="py-2">
                  <div className="flex items-center gap-1.5 px-4 py-1.5">
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    <span className="text-sm font-semibold text-destructive">
                      違反 {errorGroups.reduce((s, g) => s + g.items.length, 0)}件
                    </span>
                  </div>
                  {errorGroups.map((group) => (
                    <ViolationGroup key={group.type} group={group} severity="error" />
                  ))}
                </section>
              )}

              {/* 警告セクション */}
              {warningGroups.length > 0 && (
                <section className="py-2">
                  <div className="flex items-center gap-1.5 px-4 py-1.5">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                    <span className="text-sm font-semibold text-yellow-600">
                      警告 {warningGroups.reduce((s, g) => s + g.items.length, 0)}件
                    </span>
                  </div>
                  {warningGroups.map((group) => (
                    <ViolationGroup key={group.type} group={group} severity="warning" />
                  ))}
                </section>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ViolationGroup({ group, severity }: { group: GroupedViolation; severity: ViolationSeverity }) {
  return (
    <div className="px-4 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <Badge
          variant={severity === 'error' ? 'destructive' : 'outline'}
          className={`text-[10px] h-5 px-1.5 ${
            severity === 'warning' ? 'border-yellow-500 text-yellow-600' : ''
          }`}
        >
          {group.label}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {group.items.length}件
        </span>
      </div>
      <ul className="space-y-1 ml-1">
        {group.items.map((item, i) => (
          <li
            key={`${item.orderId}-${item.staffId ?? ''}-${i}`}
            className="text-xs leading-relaxed text-foreground"
          >
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
