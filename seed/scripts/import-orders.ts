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

interface IrregularPatternRow {
  customer_id: string;
  type: string;
  description: string;
  active_weeks: string;
}

/** 日付が月の第何週（0-based）かを返す */
function getWeekOfMonth(d: Date): number {
  return Math.floor((d.getDate() - 1) / 7);
}

/** 不定期パターンに基づき、指定日にサービスを実施するかを判定 */
function shouldGenerateOrder(
  patterns: IrregularPatternRow[],
  orderDate: Date,
): boolean {
  if (patterns.length === 0) return true;

  for (const p of patterns) {
    if (p.type === 'temporary_stop') return false;
    if ((p.type === 'biweekly' || p.type === 'monthly') && p.active_weeks) {
      const weekOfMonth = getWeekOfMonth(orderDate);
      const activeWeeks = p.active_weeks.split(',').map((w) => parseInt(w.trim(), 10));
      if (!activeWeeks.includes(weekOfMonth)) return false;
    }
  }
  return true;
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
  const irregularPatterns = parseCSV<IrregularPatternRow>(resolve(DATA_DIR, 'customer-irregular-patterns.csv'));
  const now = Timestamp.now();

  const weekStart = new Date(weekStartDate + 'T00:00:00+09:00');
  const weekStartTs = Timestamp.fromDate(weekStart);

  let orderNum = 1;
  const docs: { id: string; data: Record<string, unknown> }[] = [];

  // 連続訪問のペアを追跡（household_idベース）
  const householdOrders: Record<string, { id: string; start_time: string; end_time: string }[]> = {};

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

    // 不定期パターンに基づきスキップ判定
    const customerPatterns = irregularPatterns.filter((p) => p.customer_id === s.customer_id);
    if (!shouldGenerateOrder(customerPatterns, orderDate)) continue;

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

    // household_id による連続訪問リンク追跡（同日・同世帯でグループ化）
    const householdId = customerHousehold.get(s.customer_id);
    if (householdId) {
      const key = `${householdId}-${s.day_of_week}`;
      if (!householdOrders[key]) {
        householdOrders[key] = [];
      }
      householdOrders[key].push({ id: orderId, start_time: s.start_time, end_time: s.end_time });
    }
  }

  // 連続訪問のリンクを設定（開始時刻順にソートし、隙間30分以内の隣接ペアをリンク）
  const GAP_MINUTES = 30;
  const timeToMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  for (const orders of Object.values(householdOrders)) {
    if (orders.length < 2) continue;
    const sorted = [...orders].sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (let i = 0; i < sorted.length - 1; i++) {
      const o1 = sorted[i];
      const o2 = sorted[i + 1];
      const e1 = timeToMinutes(o1.end_time);
      const s2 = timeToMinutes(o2.start_time);
      if (s2 - e1 <= GAP_MINUTES) {
        const doc1 = docs.find((d) => d.id === o1.id);
        const doc2 = docs.find((d) => d.id === o2.id);
        if (doc1) doc1.data.linked_order_id = o2.id;
        if (doc2) doc2.data.linked_order_id = o1.id;
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
