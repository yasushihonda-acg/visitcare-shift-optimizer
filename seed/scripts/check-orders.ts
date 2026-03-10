import { getDB } from './utils/firestore-client.js';

const db = getDB();

/** Firestore Timestamp を JST の YYYY-MM-DD に変換 */
function toJSTDateStr(ts: any): string {
  const d: Date = ts?.toDate?.() ?? ts;
  if (!(d instanceof Date) || isNaN(d.getTime())) return 'invalid';
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

async function checkOverlaps() {
  const allSnap = await db.collection('orders').get();
  const allOrders = allSnap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, any>));

  const assigned = allOrders.filter(o => (o.assigned_staff_ids ?? []).length > 0);
  console.log(`Total: ${allOrders.length}, Assigned: ${assigned.length}, Unassigned: ${allOrders.length - assigned.length}`);

  // スタッフ別にグループ化
  const byStaff = new Map<string, any[]>();
  for (const o of assigned) {
    for (const sid of o.assigned_staff_ids) {
      const list = byStaff.get(sid) || [];
      list.push(o);
      byStaff.set(sid, list);
    }
  }

  let overlapCount = 0;
  for (const [staffId, orders] of byStaff) {
    // 同一日でグループ化
    const byDay = new Map<string, any[]>();
    for (const o of orders) {
      const day = toJSTDateStr(o.date);
      const list = byDay.get(day) || [];
      list.push(o);
      byDay.set(day, list);
    }

    for (const [day, dayOrders] of byDay) {
      const sorted = dayOrders.sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
      for (let i = 0; i < sorted.length - 1; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          if (sorted[j].start_time >= sorted[i].end_time) break;
          // linked_order_idのペアはスキップ
          if (sorted[i].linked_order_id === sorted[j].id || sorted[j].linked_order_id === sorted[i].id) continue;
          overlapCount++;
          console.log(`OVERLAP: staff=${staffId} | ${day}`);
          console.log(`  ${sorted[i].id} | C=${sorted[i].customer_id} | ${sorted[i].start_time}-${sorted[i].end_time} | svc=${sorted[i].service_type}`);
          console.log(`  ${sorted[j].id} | C=${sorted[j].customer_id} | ${sorted[j].start_time}-${sorted[j].end_time} | svc=${sorted[j].service_type}`);
        }
      }
    }
  }

  console.log(`\nTotal overlaps: ${overlapCount}`);
}

checkOverlaps().then(() => process.exit(0)).catch(console.error);
