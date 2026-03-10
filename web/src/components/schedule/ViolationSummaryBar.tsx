'use client';

import { useMemo } from 'react';
import { AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import type { Violation, ViolationMap } from '@/lib/constraints/checker';
import { VIOLATION_TYPE_LABELS } from '@/lib/constraints/labels';

interface ViolationSummaryBarProps {
  violations: ViolationMap;
  onOpenPanel: () => void;
}

interface TypeCount {
  type: Violation['type'];
  label: string;
  count: number;
}

function groupByType(violations: Violation[]): TypeCount[] {
  const map = new Map<Violation['type'], number>();
  for (const v of violations) {
    map.set(v.type, (map.get(v.type) ?? 0) + 1);
  }
  const result: TypeCount[] = [];
  for (const [type, count] of map) {
    result.push({ type, label: VIOLATION_TYPE_LABELS[type], count });
  }
  return result.sort((a, b) => b.count - a.count);
}

export function ViolationSummaryBar({ violations, onOpenPanel }: ViolationSummaryBarProps) {
  const all = useMemo(
    () => Array.from(violations.values()).flat(),
    [violations],
  );

  const errors = useMemo(() => groupByType(all.filter((v) => v.severity === 'error')), [all]);
  const warnings = useMemo(() => groupByType(all.filter((v) => v.severity === 'warning')), [all]);

  if (errors.length === 0 && warnings.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 border-b bg-muted/30 text-xs">
      {errors.length > 0 && (
        <div className="flex items-center gap-2">
          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
          <div className="flex items-center gap-1.5 flex-wrap">
            {errors.map((g) => (
              <span key={g.type} className="inline-flex items-center gap-0.5 text-destructive">
                <span className="font-medium">{g.label}</span>
                <span className="text-destructive/70">{g.count}件</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {errors.length > 0 && warnings.length > 0 && (
        <span className="text-muted-foreground/40">|</span>
      )}
      {warnings.length > 0 && (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 shrink-0" />
          <div className="flex items-center gap-1.5 flex-wrap">
            {warnings.map((g) => (
              <span key={g.type} className="inline-flex items-center gap-0.5 text-yellow-600">
                <span className="font-medium">{g.label}</span>
                <span className="text-yellow-600/70">{g.count}件</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onOpenPanel}
        className="ml-auto flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="詳細を表示"
      >
        <span>詳細</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
