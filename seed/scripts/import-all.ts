import { clearCollection, getDB } from './utils/firestore-client.js';
import { validateAll } from './validate-data.js';
import { importCustomers } from './import-customers.js';
import { importHelpers } from './import-helpers.js';
import { importOrders } from './import-orders.js';
import { generateTravelTimes } from './generate-travel-times.js';
import { importStaffUnavailability } from './import-staff-unavailability.js';

const COLLECTIONS = [
  'customers',
  'helpers',
  'orders',
  'travel_times',
  'staff_unavailability',
];

async function main() {
  console.log('=== Seed Data Import ===\n');

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

  const orderCount = await importOrders();
  console.log(`   orders: ${orderCount}`);

  const travelTimeCount = await generateTravelTimes();
  console.log(`   travel_times: ${travelTimeCount}`);

  const unavailCount = await importStaffUnavailability();
  console.log(`   staff_unavailability: ${unavailCount}`);

  console.log('\n✅ Import complete!');
  console.log(`   Total: ${customerCount + helperCount + orderCount + travelTimeCount + unavailCount} documents`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
