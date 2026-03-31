import { resolve } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { parseCSV } from './utils/csv-parser.js';
import { batchWrite } from './utils/firestore-client.js';

const DATA_DIR = process.env.SEED_DATA_DIR
  ? resolve(process.env.SEED_DATA_DIR)
  : resolve(import.meta.dirname, '../data');

interface ServiceTypeRow {
  code: string;
  category: string;
  label: string;
  duration: string;
  care_level: string;
  units: string;
  requires_physical_care_cert: string;
  sort_order: string;
}

export async function importServiceTypes(): Promise<number> {
  const rows = parseCSV<ServiceTypeRow>(resolve(DATA_DIR, 'service-types.csv'));

  const now = Timestamp.now();

  const docs = rows.map((row) => ({
    id: row.code,
    data: {
      code: row.code,
      category: row.category,
      label: row.label,
      duration: row.duration,
      care_level: row.care_level,
      units: parseInt(row.units, 10) || 0,
      short_label: row.label,
      requires_physical_care_cert: row.requires_physical_care_cert === 'true',
      sort_order: parseInt(row.sort_order, 10),
      created_at: now,
      updated_at: now,
    },
  }));

  return batchWrite('service_types', docs);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  importServiceTypes().then((count) => {
    console.log(`Imported ${count} service types`);
    process.exit(0);
  });
}
