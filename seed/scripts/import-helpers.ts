import { resolve } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { parseCSV } from './utils/csv-parser.js';
import { batchWrite } from './utils/firestore-client.js';

const DATA_DIR = resolve(import.meta.dirname, '../data');

interface HelperRow {
  id: string;
  family_name: string;
  given_name: string;
  short_name: string;
  qualifications: string;
  can_physical_care: string;
  transportation: string;
  preferred_hours_min: string;
  preferred_hours_max: string;
  available_hours_min: string;
  available_hours_max: string;
  employment_type: string;
  gender: string;
  employee_number: string;
  address: string;
  phone_number: string;
}

interface AvailabilityRow {
  helper_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

interface TrainingStatusRow {
  helper_id: string;
  customer_id: string;
  status: string;
}

export async function importHelpers(): Promise<number> {
  const helpers = parseCSV<HelperRow>(resolve(DATA_DIR, 'helpers.csv'));
  const availability = parseCSV<AvailabilityRow>(resolve(DATA_DIR, 'helper-availability.csv'));
  const trainingRows = parseCSV<TrainingStatusRow>(resolve(DATA_DIR, 'helper-training-status.csv'));

  const now = Timestamp.now();

  const docs = helpers.map((h) => {
    // 曜日別可用性を構築
    const helperAvail = availability.filter((a) => a.helper_id === h.id);
    const weeklyAvailability: Record<string, Array<{
      start_time: string;
      end_time: string;
    }>> = {};

    for (const a of helperAvail) {
      if (!weeklyAvailability[a.day_of_week]) {
        weeklyAvailability[a.day_of_week] = [];
      }
      weeklyAvailability[a.day_of_week].push({
        start_time: a.start_time,
        end_time: a.end_time,
      });
    }

    // 資格をパース
    const qualifications = h.qualifications
      ? h.qualifications.split(',').map((q) => q.trim())
      : [];

    return {
      id: h.id,
      data: {
        name: {
          family: h.family_name,
          given: h.given_name,
          ...(h.short_name ? { short: h.short_name } : {}),
        },
        qualifications,
        can_physical_care: h.can_physical_care === 'true',
        transportation: h.transportation,
        weekly_availability: weeklyAvailability,
        preferred_hours: {
          min: parseInt(h.preferred_hours_min, 10),
          max: parseInt(h.preferred_hours_max, 10),
        },
        available_hours: {
          min: parseInt(h.available_hours_min, 10),
          max: parseInt(h.available_hours_max, 10),
        },
        customer_training_status: Object.fromEntries(
          trainingRows
            .filter((t) => t.helper_id === h.id)
            .map((t) => [t.customer_id, t.status]),
        ),
        employment_type: h.employment_type,
        gender: h.gender,
        ...(h.employee_number ? { employee_number: h.employee_number } : {}),
        ...(h.address ? { address: h.address } : {}),
        ...(h.phone_number ? { phone_number: h.phone_number } : {}),
        created_at: now,
        updated_at: now,
      },
    };
  });

  return batchWrite('helpers', docs);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  importHelpers().then((count) => {
    console.log(`Imported ${count} helpers`);
    process.exit(0);
  });
}
