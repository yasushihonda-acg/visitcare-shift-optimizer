import { resolve } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { parseCSV } from './utils/csv-parser.js';
import { batchWrite } from './utils/firestore-client.js';

const DATA_DIR = resolve(import.meta.dirname, '../data');

interface ServiceTypeRow {
  code: string;
  label: string;
  short_label: string;
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
      label: row.label,
      short_label: row.short_label,
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
