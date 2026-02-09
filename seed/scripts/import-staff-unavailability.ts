import { resolve } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { parseCSV } from './utils/csv-parser.js';
import { batchWrite } from './utils/firestore-client.js';

const DATA_DIR = resolve(import.meta.dirname, '../data');

interface UnavailabilityRow {
  staff_id: string;
  week_start_date: string;
  date: string;
  all_day: string;
  start_time: string;
  end_time: string;
  notes: string;
}

export async function importStaffUnavailability(): Promise<number> {
  const rows = parseCSV<UnavailabilityRow>(resolve(DATA_DIR, 'staff-unavailability.csv'));

  // staff_id + week_start_date でグループ化
  const grouped = new Map<string, UnavailabilityRow[]>();
  for (const row of rows) {
    const key = `${row.staff_id}_${row.week_start_date}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(row);
  }

  const docs = Array.from(grouped.entries()).map(([key, entries]) => {
    const first = entries[0];
    const weekStart = new Date(first.week_start_date + 'T00:00:00+09:00');

    const unavailableSlots = entries.map((e) => {
      const date = new Date(e.date + 'T00:00:00+09:00');
      const allDay = e.all_day === 'true';
      return {
        date: Timestamp.fromDate(date),
        all_day: allDay,
        ...(allDay ? {} : { start_time: e.start_time, end_time: e.end_time }),
      };
    });

    const notes = entries.map((e) => e.notes).filter(Boolean).join('; ');

    return {
      id: key,
      data: {
        staff_id: first.staff_id,
        week_start_date: Timestamp.fromDate(weekStart),
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
