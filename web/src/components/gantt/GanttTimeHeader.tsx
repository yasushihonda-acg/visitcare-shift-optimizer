'use client';

import { GANTT_START_HOUR, GANTT_END_HOUR, HELPER_NAME_WIDTH_PX, TOTAL_SLOTS } from './constants';
import { useSlotWidth } from './GanttScaleContext';

export function GanttTimeHeader() {
  const slotWidth = useSlotWidth();
  const hours = Array.from(
    { length: GANTT_END_HOUR - GANTT_START_HOUR },
    (_, i) => GANTT_START_HOUR + i
  );

  return (
    <div className="flex border-b bg-gradient-to-b from-accent/50 to-accent/20 backdrop-blur-sm sticky top-0 z-10">
      <div
        className="shrink-0 border-r px-2 py-1.5 text-xs font-semibold text-primary"
        style={{ width: HELPER_NAME_WIDTH_PX }}
      >
        ヘルパー
      </div>
      <div
        className="relative"
        style={{ width: TOTAL_SLOTS * slotWidth }}
      >
        {hours.map((hour) => {
          const slotsPerHour = 60 / 5;
          const hourLeft = (hour - GANTT_START_HOUR) * slotsPerHour * slotWidth;
          return (
            <div key={hour}>
              {/* 正時の線 + ラベル */}
              <div
                className="absolute top-0 h-full border-l border-border/40"
                style={{ left: hourLeft }}
              >
                <span className="px-1 text-[10px] font-medium text-muted-foreground">
                  {hour}:00
                </span>
              </div>
              {/* 10分刻みのサブ目盛り（:10, :20, :30, :40, :50） */}
              {[10, 20, 30, 40, 50].map((min) => {
                const subLeft = hourLeft + (min / 5) * slotWidth;
                return (
                  <div
                    key={`${hour}:${min}`}
                    className={`absolute h-full border-l ${min === 30 ? 'border-border/25' : 'border-border/10'}`}
                    style={{ left: subLeft, top: 0 }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
