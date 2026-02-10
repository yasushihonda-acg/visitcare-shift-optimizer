'use client';

import { WeekSelector } from '@/components/schedule/WeekSelector';

export function Header() {
  return (
    <header className="border-b bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">VisitCare シフト最適化</h1>
        <WeekSelector />
      </div>
    </header>
  );
}
