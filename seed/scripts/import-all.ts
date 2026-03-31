import { clearCollection, getDB } from './utils/firestore-client.js';
import { validateAll } from './validate-data.js';
import { importCustomers } from './import-customers.js';
import { importHelpers } from './import-helpers.js';
import { importOrders } from './import-orders.js';
import { generateTravelTimes } from './generate-travel-times.js';
import { importStaffUnavailability } from './import-staff-unavailability.js';
import { importServiceTypes } from './import-service-types.js';

const BATCH_LIMIT = 500;
const ASSIGN_RATIO = 0.8;

const COLLECTIONS = [
  'service_types',
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

function parseArgs(): {
  week?: string;
  weeks?: string[];
  ordersOnly?: boolean;
  dataDir?: string;
  skipValidation?: boolean;
  skipAssign?: boolean;
} {
  const args = process.argv.slice(2);
  const result: {
    week?: string;
    weeks?: string[];
    ordersOnly?: boolean;
    dataDir?: string;
    skipValidation?: boolean;
    skipAssign?: boolean;
  } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--week' && args[i + 1]) {
      result.week = args[i + 1];
      i++;
    } else if (args[i] === '--weeks' && args[i + 1]) {
      result.weeks = args[i + 1].split(',').map((s) => s.trim());
      i++;
    } else if (args[i] === '--orders-only') {
      result.ordersOnly = true;
    } else if (args[i] === '--data-dir' && args[i + 1]) {
      result.dataDir = args[i + 1];
      i++;
    } else if (args[i] === '--skip-validation') {
      result.skipValidation = true;
    } else if (args[i] === '--skip-assign') {
      result.skipAssign = true;
    }
  }
  return result;
}

async function main() {
  const { week, weeks, ordersOnly, dataDir, skipValidation, skipAssign } = parseArgs();

  // --data-dir 指定時は SEED_DATA_DIR 環境変数を設定（子モジュールに伝搬）
  if (dataDir) {
    const { resolve } = await import('path');
    process.env.SEED_DATA_DIR = resolve(dataDir);
    console.log(`📂 Data directory: ${process.env.SEED_DATA_DIR}`);
  }

  console.log('=== Seed Data Import ===\n');

  // 生成対象週のリストを決定（--weeks > --week > undefined（現在の週））
  const targetWeeks: Array<string | undefined> = weeks ?? (week ? [week] : [undefined]);

  if (targetWeeks.length > 1) {
    console.log(`📅 Weeks: ${targetWeeks.join(', ')}\n`);
  } else if (targetWeeks[0]) {
    console.log(`📅 Week start date: ${targetWeeks[0]}\n`);
  }

  // 1. バリデーション
  if (skipValidation) {
    console.log('⏭️  Skipping validation (--skip-validation)\n');
  } else {
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
  }

  if (ordersOnly) {
    // ordersのみ再生成（週を切り替える時・複数週追加時に便利）
    console.log('🗑️  Clearing orders...');
    const deleted = await clearCollection('orders');
    if (deleted > 0) {
      console.log(`   Cleared ${deleted} docs from orders`);
    }
    console.log('');

    let totalOrders = 0;
    for (const w of targetWeeks) {
      const label = w ?? '(current week)';
      console.log(`📥 Importing orders for week ${label}...`);
      const orderCount = await importOrders(w);
      console.log(`   orders (${label}): ${orderCount}`);
      totalOrders += orderCount;
    }

    if (skipAssign) {
      console.log(`\n   total orders: ${totalOrders}`);
      console.log('   assigned: skipped (--skip-assign)');
    } else {
      const assignedCount = await assignSampleOrders();
      console.log(`\n   total orders: ${totalOrders}`);
      console.log(`   assigned: ${assignedCount}/${totalOrders}`);
    }

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

  // 3. インポート（順序制御: service_types → customers/helpers → orders → travel_times → unavailability）
  console.log('📥 Importing data...');

  const serviceTypeCount = await importServiceTypes();
  console.log(`   service_types: ${serviceTypeCount}`);

  const customerCount = await importCustomers();
  console.log(`   customers: ${customerCount}`);

  const helperCount = await importHelpers();
  console.log(`   helpers: ${helperCount}`);

  let totalOrders = 0;
  for (const w of targetWeeks) {
    const label = w ?? '(current week)';
    const orderCount = await importOrders(w);
    console.log(`   orders (${label}): ${orderCount}`);
    totalOrders += orderCount;
  }

  if (skipAssign) {
    console.log('   assigned: skipped (--skip-assign)');
  } else {
    const assignedCount = await assignSampleOrders();
    console.log(`   assigned: ${assignedCount}/${totalOrders}`);
  }

  let travelTimeCount = 0;
  if (skipValidation) {
    console.log('   travel_times: skipped (no lat/lng data)');
  } else {
    travelTimeCount = await generateTravelTimes();
    console.log(`   travel_times: ${travelTimeCount}`);
  }

  const unavailCount = await importStaffUnavailability(targetWeeks[0]);
  console.log(`   staff_unavailability: ${unavailCount}`);

  console.log('\n✅ Import complete!');
  console.log(`   Total: ${serviceTypeCount + customerCount + helperCount + totalOrders + travelTimeCount + unavailCount} documents`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
