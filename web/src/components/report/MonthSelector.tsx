'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

interface MonthSelectorProps {
  month: Date;
  onChange: (month: Date) => void;
}

export function MonthSelector({ month, onChange }: MonthSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(subMonths(month, 1))}
        aria-label="前月"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className="min-w-[7rem] text-center text-sm font-medium">
        {format(month, 'yyyy年M月', { locale: ja })}
      </span>

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange(addMonths(month, 1))}
        aria-label="次月"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
