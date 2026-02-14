import { resolve } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { parseCSV } from './utils/csv-parser.js';
import { batchWrite, getDB } from './utils/firestore-client.js';

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

interface ServiceRow {
  customer_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  service_type: string;
  staff_count: string;
}

/**
 * weekly_services からオーダーを生成
 * weekStartDate: 週の月曜日（YYYY-MM-DD）
 */
export async function importOrders(weekStartDate?: string): Promise<number> {
  if (!weekStartDate) {
    weekStartDate = getCurrentMonday();
  }
  const services = parseCSV<ServiceRow>(resolve(DATA_DIR, 'customer-services.csv'));
  const now = Timestamp.now();

  const weekStart = new Date(weekStartDate + 'T00:00:00+09:00');
  const weekStartTs = Timestamp.fromDate(weekStart);

  let orderNum = 1;
  const docs: { id: string; data: Record<string, unknown> }[] = [];

  // 連続訪問のペアを追跡（household_idベース）
  const householdOrders: Record<string, string[]> = {};

  // customers.csv から household_id を取得
  const customers = parseCSV<{ id: string; household_id: string }>(
    resolve(DATA_DIR, 'customers.csv'),
  );
  const customerHousehold = new Map(
    customers.filter((c) => c.household_id).map((c) => [c.id, c.household_id]),
  );

  for (const s of services) {
    const dayOffset = DAY_TO_OFFSET[s.day_of_week];
    if (dayOffset === undefined) continue;

    const orderDate = new Date(weekStart);
    orderDate.setDate(orderDate.getDate() + dayOffset);

    const orderId = `ORD-${weekStartDate.replace(/-/g, '')}-${String(orderNum).padStart(4, '0')}`;
    orderNum++;

    const doc = {
      id: orderId,
      data: {
        customer_id: s.customer_id,
        week_start_date: weekStartTs,
        date: Timestamp.fromDate(orderDate),
        start_time: s.start_time,
        end_time: s.end_time,
        service_type: s.service_type,
        assigned_staff_ids: [],
        status: 'pending',
        manually_edited: false,
        created_at: now,
        updated_at: now,
      } as Record<string, unknown>,
    };

    docs.push(doc);

    // household_id による連続訪問リンク追跡
    const householdId = customerHousehold.get(s.customer_id);
    if (householdId) {
      const key = `${householdId}-${s.day_of_week}-${s.start_time}`;
      if (!householdOrders[key]) {
        householdOrders[key] = [];
      }
      householdOrders[key].push(orderId);
    }
  }

  // 連続訪問のリンクを設定
  for (const orderIds of Object.values(householdOrders)) {
    if (orderIds.length >= 2) {
      for (let i = 0; i < orderIds.length; i++) {
        const doc = docs.find((d) => d.id === orderIds[i]);
        if (doc) {
          // 次のオーダーにリンク（最後は最初にリンク）
          const nextIdx = (i + 1) % orderIds.length;
          doc.data.linked_order_id = orderIds[nextIdx];
        }
      }
    }
  }

  return batchWrite('orders', docs);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  importOrders().then((count) => {
    console.log(`Generated ${count} orders`);
    process.exit(0);
  });
}
