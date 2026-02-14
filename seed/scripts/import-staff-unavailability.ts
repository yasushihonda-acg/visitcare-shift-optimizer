import { resolve } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { parseCSV } from './utils/csv-parser.js';
import { batchWrite } from './utils/firestore-client.js';

const DATA_DIR = resolve(import.meta.dirname, '../data');

const DAY_TO_OFFSET: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

interface UnavailabilityRow {
  staff_id: string;
  day_of_week: string;
  all_day: string;
  start_time: string;
  end_time: string;
  notes: string;
}

/** 今日を含む週の月曜日をYYYY-MM-DD形式で返す */
function getCurrentMonday(): string {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const day = jst.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  jst.setDate(jst.getDate() + diff);
  const y = jst.getFullYear();
  const m = String(jst.getMonth() + 1).padStart(2, '0');
  const d = String(jst.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function importStaffUnavailability(weekStartDate?: string): Promise<number> {
  if (!weekStartDate) {
    weekStartDate = getCurrentMonday();
  }

  const rows = parseCSV<UnavailabilityRow>(resolve(DATA_DIR, 'staff-unavailability.csv'));
  const weekStart = new Date(weekStartDate + 'T00:00:00+09:00');
  const weekStartTs = Timestamp.fromDate(weekStart);

  // staff_id でグループ化
  const grouped = new Map<string, UnavailabilityRow[]>();
  for (const row of rows) {
    const key = row.staff_id;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(row);
  }

  const docs = Array.from(grouped.entries()).map(([staffId, entries]) => {
    const unavailableSlots = entries.map((e) => {
      const dayOffset = DAY_TO_OFFSET[e.day_of_week] ?? 0;
      const date = new Date(weekStart);
      date.setDate(date.getDate() + dayOffset);

      const allDay = e.all_day === 'true';
      return {
        date: Timestamp.fromDate(date),
        all_day: allDay,
        ...(allDay ? {} : { start_time: e.start_time, end_time: e.end_time }),
      };
    });

    const notes = entries.map((e) => e.notes).filter(Boolean).join('; ');

    return {
      id: `${staffId}_${weekStartDate}`,
      data: {
        staff_id: staffId,
        week_start_date: weekStartTs,
        unavailable_slots: unavailableSlots,
        ...(notes ? { notes } : {}),
        submitted_at: Timestamp.now(),
      },
    };
  });

  return batchWrite('staff_unavailability', docs);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  importStaffUnavailability().then((count) => {
    console.log(`Imported ${count} staff unavailability records`);
    process.exit(0);
  });
}
