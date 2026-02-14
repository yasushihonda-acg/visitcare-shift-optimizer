'use client';

import { GANTT_START_HOUR, GANTT_END_HOUR, SLOT_WIDTH_PX, HELPER_NAME_WIDTH_PX, TOTAL_SLOTS } from './constants';

export function GanttTimeHeader() {
  const hours = Array.from(
    { length: GANTT_END_HOUR - GANTT_START_HOUR },
    (_, i) => GANTT_START_HOUR + i
  );

  return (
    <div className="flex border-b bg-gradient-to-b from-muted/80 to-muted/40 sticky top-0 z-10">
      <div
        className="shrink-0 border-r px-2 py-1.5 text-xs font-semibold text-primary"
        style={{ width: HELPER_NAME_WIDTH_PX }}
      >
        ヘルパー
      </div>
      <div
        className="relative"
        style={{ width: TOTAL_SLOTS * SLOT_WIDTH_PX }}
      >
        {hours.map((hour) => {
          const slotsPerHour = 60 / 5;
          const left = (hour - GANTT_START_HOUR) * slotsPerHour * SLOT_WIDTH_PX;
          return (
            <div
              key={hour}
              className="absolute top-0 h-full border-l border-border/40"
              style={{ left }}
            >
              <span className="px-1 text-[10px] font-medium text-muted-foreground">
                {hour}:00
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
