'use client';

import { Heart } from 'lucide-react';
import { WeekSelector } from '@/components/schedule/WeekSelector';

export function Header() {
  return (
    <header className="bg-gradient-to-r from-primary to-[oklch(0.45_0.10_210)] px-4 py-3 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
            <Heart className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">
              VisitCare
            </h1>
            <p className="text-[10px] text-white/70 leading-none">
              シフト最適化
            </p>
          </div>
        </div>
        <WeekSelector variant="header" />
      </div>
    </header>
  );
}
