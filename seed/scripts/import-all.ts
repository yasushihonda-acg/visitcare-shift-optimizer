import { clearCollection, getDB } from './utils/firestore-client.js';
import { validateAll } from './validate-data.js';
import { importCustomers } from './import-customers.js';
import { importHelpers } from './import-helpers.js';
import { importOrders } from './import-orders.js';
import { generateTravelTimes } from './generate-travel-times.js';
import { importStaffUnavailability } from './import-staff-unavailability.js';

const BATCH_LIMIT = 500;
const ASSIGN_RATIO = 0.8;

const COLLECTIONS = [
  'customers',
  'helpers',
  'orders',
  'travel_times',
  'staff_unavailability',
];

/**
 * E2Eテスト用: Seedオーダーの80%をヘルパーにラウンドロビン割当。
 * スケジュール画面のガントバー表示に割当済みオーダーが必要。
 */
async function assignSampleOrders(): Promise<number> {
  const db = getDB();
  const helpersSnap = await db.collection('helpers').get();
  const helperIds = helpersSnap.docs.map((d) => d.id);
  if (helperIds.length === 0) return 0;

  const ordersSnap = await db.collection('orders').get();
  const docs = ordersSnap.docs;
  const assignCount = Math.floor(docs.length * ASSIGN_RATIO);

  for (let i = 0; i < assignCount; i += BATCH_LIMIT) {
    const batch = db.batch();
    const end = Math.min(i + BATCH_LIMIT, assignCount);
    for (let j = i; j < end; j++) {
      const helperId = helperIds[j % helperIds.length];
      batch.update(docs[j].ref, { assigned_staff_ids: [helperId] });
    }
    await batch.commit();
  }
  return assignCount;
}

function parseArgs(): { week?: string; ordersOnly?: boolean } {
  const args = process.argv.slice(2);
  const result: { week?: string; ordersOnly?: boolean } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--week' && args[i + 1]) {
      result.week = args[i + 1];
      i++;
    }
    if (args[i] === '--orders-only') {
      result.ordersOnly = true;
    }
  }
  return result;
}

async function main() {
  const { week, ordersOnly } = parseArgs();

  console.log('=== Seed Data Import ===\n');

  if (week) {
    console.log(`📅 Week start date: ${week}\n`);
  }

  // 1. バリデーション
  console.log('📋 Validating CSV data...');
  const errors = validateAll();
  if (errors.length > 0) {
    console.error(`❌ ${errors.length} validation error(s) found:`);
    for (const e of errors) {
      console.error(`  ${e.file}${e.row ? `:${e.row}` : ''} ${e.field ? `[${e.field}]` : ''} ${e.message}`);
    }
    process.exit(1);
  }
  console.log('✅ All validations passed\n');

  if (ordersOnly) {
    // ordersのみ再生成（本番で週を切り替える時に便利）
    console.log('🗑️  Clearing orders...');
    const deleted = await clearCollection('orders');
    if (deleted > 0) {
      console.log(`   Cleared ${deleted} docs from orders`);
    }
    console.log('');

    console.log('📥 Importing orders...');
    const orderCount = await importOrders(week);
    console.log(`   orders: ${orderCount}`);

    const assignedCount = await assignSampleOrders();
    console.log(`   assigned: ${assignedCount}/${orderCount}`);

    console.log('\n✅ Import complete!');
    process.exit(0);
  }

  // 2. 既存データクリア
  console.log('🗑️  Clearing existing data...');
  for (const col of COLLECTIONS) {
    const deleted = await clearCollection(col);
    if (deleted > 0) {
      console.log(`   Cleared ${deleted} docs from ${col}`);
    }
  }
  console.log('');

  // 3. インポート（順序制御: customers/helpers → orders → travel_times → unavailability）
  console.log('📥 Importing data...');

  const customerCount = await importCustomers();
  console.log(`   customers: ${customerCount}`);

  const helperCount = await importHelpers();
  console.log(`   helpers: ${helperCount}`);

  const orderCount = await importOrders(week);
  console.log(`   orders: ${orderCount}`);

  const assignedCount = await assignSampleOrders();
  console.log(`   assigned: ${assignedCount}/${orderCount}`);

  const travelTimeCount = await generateTravelTimes();
  console.log(`   travel_times: ${travelTimeCount}`);

  const unavailCount = await importStaffUnavailability(week);
  console.log(`   staff_unavailability: ${unavailCount}`);

  console.log('\n✅ Import complete!');
  console.log(`   Total: ${customerCount + helperCount + orderCount + travelTimeCount + unavailCount} documents`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
