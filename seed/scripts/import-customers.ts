import { resolve } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { parseCSV } from './utils/csv-parser.js';
import { batchWrite, getDB } from './utils/firestore-client.js';

const DATA_DIR = resolve(import.meta.dirname, '../data');

interface CustomerRow {
  id: string;
  family_name: string;
  given_name: string;
  address: string;
  lat: string;
  lng: string;
  service_manager: string;
  household_id: string;
  notes: string;
}

interface ServiceRow {
  customer_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  service_type: string;
  staff_count: string;
}

interface ConstraintRow {
  customer_id: string;
  staff_id: string;
  constraint_type: string;
}

export async function importCustomers(): Promise<number> {
  const customers = parseCSV<CustomerRow>(resolve(DATA_DIR, 'customers.csv'));
  const services = parseCSV<ServiceRow>(resolve(DATA_DIR, 'customer-services.csv'));
  const constraints = parseCSV<ConstraintRow>(resolve(DATA_DIR, 'customer-staff-constraints.csv'));

  const now = Timestamp.now();

  const docs = customers.map((c) => {
    // 曜日別サービス枠を構築
    const customerServices = services.filter((s) => s.customer_id === c.id);
    const weeklyServices: Record<string, Array<{
      start_time: string;
      end_time: string;
      service_type: string;
      staff_count: number;
    }>> = {};

    for (const s of customerServices) {
      if (!weeklyServices[s.day_of_week]) {
        weeklyServices[s.day_of_week] = [];
      }
      weeklyServices[s.day_of_week].push({
        start_time: s.start_time,
        end_time: s.end_time,
        service_type: s.service_type,
        staff_count: parseInt(s.staff_count, 10),
      });
    }

    // NG/推奨スタッフ
    const customerConstraints = constraints.filter((ct) => ct.customer_id === c.id);
    const ngStaffIds = customerConstraints
      .filter((ct) => ct.constraint_type === 'ng')
      .map((ct) => ct.staff_id);
    const preferredStaffIds = customerConstraints
      .filter((ct) => ct.constraint_type === 'preferred')
      .map((ct) => ct.staff_id);

    return {
      id: c.id,
      data: {
        name: { family: c.family_name, given: c.given_name },
        address: c.address,
        location: { lat: parseFloat(c.lat), lng: parseFloat(c.lng) },
        ng_staff_ids: ngStaffIds,
        preferred_staff_ids: preferredStaffIds,
        weekly_services: weeklyServices,
        ...(c.household_id ? { household_id: c.household_id } : {}),
        service_manager: c.service_manager,
        ...(c.notes ? { notes: c.notes } : {}),
        created_at: now,
        updated_at: now,
      },
    };
  });

  return batchWrite('customers', docs);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  importCustomers().then((count) => {
    console.log(`Imported ${count} customers`);
    process.exit(0);
  });
}
