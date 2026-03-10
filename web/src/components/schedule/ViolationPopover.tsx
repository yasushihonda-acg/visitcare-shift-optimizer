'use client';

import { useMemo } from 'react';
import { AlertTriangle, XCircle, PanelRightOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import type { Violation, ViolationMap, ViolationSeverity } from '@/lib/constraints/checker';
import { VIOLATION_TYPE_LABELS } from '@/lib/constraints/labels';

interface ViolationPopoverProps {
  violations: ViolationMap;
  severity: ViolationSeverity;
  count: number;
  onBadgeClick?: (severity: ViolationSeverity) => void;
}

interface GroupedViolation {
  type: Violation['type'];
  label: string;
  items: Violation[];
}

export function ViolationPopover({ violations, severity, count, onBadgeClick }: ViolationPopoverProps) {
  const grouped = useMemo(() => {
    const all = Array.from(violations.values())
      .flat()
      .filter((v) => v.severity === severity);

    const map = new Map<Violation['type'], Violation[]>();
    for (const v of all) {
      const list = map.get(v.type) ?? [];
      list.push(v);
      map.set(v.type, list);
    }

    const result: GroupedViolation[] = [];
    for (const [type, items] of map) {
      result.push({ type, label: VIOLATION_TYPE_LABELS[type], items });
    }
    return result.sort((a, b) => b.items.length - a.items.length);
  }, [violations, severity]);

  if (count === 0) return null;

  const isError = severity === 'error';

  return (
    <Popover>
      <PopoverTrigger asChild>
        {isError ? (
          <Badge
            variant="destructive"
            className="h-5 px-1.5 text-[10px] cursor-pointer hover:opacity-80 transition-opacity"
            role="button"
            aria-label={`違反${count}件の詳細を表示`}
          >
            違反{count}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="h-5 px-1.5 text-[10px] border-yellow-500 text-yellow-600 cursor-pointer hover:bg-yellow-50 transition-colors"
            role="button"
            aria-label={`警告${count}件の詳細を表示`}
          >
            警告{count}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 max-h-72 overflow-y-auto p-0"
        align="start"
      >
        <div className="sticky top-0 flex items-center gap-1.5 border-b bg-popover px-3 py-2">
          {isError ? (
            <XCircle className="h-4 w-4 text-destructive shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
          )}
          <span className="text-sm font-medium flex-1">
            {isError ? '違反' : '警告'}一覧（{count}件）
          </span>
          {onBadgeClick && (
            <button
              type="button"
              onClick={() => onBadgeClick(severity)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
              aria-label="詳細パネルを開く"
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="divide-y">
          {grouped.map((group) => (
            <div key={group.type} className="px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {group.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {group.items.length}件
                </span>
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item, i) => (
                  <li key={`${item.orderId}-${item.staffId ?? ''}-${i}`} className="text-xs leading-relaxed">
                    {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
