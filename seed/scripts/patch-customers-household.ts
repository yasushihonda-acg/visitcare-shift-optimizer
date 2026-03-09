/**
 * 利用者の same_household_customer_ids / same_facility_customer_ids を
 * 差分更新するスクリプト（他コレクションは一切触らない）
 *
 * Usage:
 *   # Emulator（デフォルト）
 *   npx tsx scripts/patch-customers-household.ts
 *
 *   # 本番Firestore
 *   SEED_TARGET=production npx tsx scripts/patch-customers-household.ts
 *
 *   # ドライラン（変更内容を表示するだけ）
 *   SEED_TARGET=production npx tsx scripts/patch-customers-household.ts --dry-run
 */
import { resolve } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { parseCSV } from './utils/csv-parser.js';
import { getDB } from './utils/firestore-client.js';
import { buildHouseholdFacilityGroups } from './utils/household-groups.js';

const DATA_DIR = resolve(import.meta.dirname, '../data');

interface CustomerRow {
  id: string;
  address: string;
  household_id: string;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const customers = parseCSV<CustomerRow>(resolve(DATA_DIR, 'customers.csv'));

  const groups = buildHouseholdFacilityGroups(customers);

  if (dryRun) {
    console.log('🔍 Dry run — 以下のフィールドが更新されます:\n');
    for (const [id, { sameHousehold, sameFacility }] of groups) {
      if (sameHousehold.length > 0 || sameFacility.length > 0) {
        console.log(`  ${id}:`);
        if (sameHousehold.length > 0)
          console.log(`    same_household_customer_ids: [${sameHousehold.join(', ')}]`);
        if (sameFacility.length > 0)
          console.log(`    same_facility_customer_ids: [${sameFacility.join(', ')}]`);
      }
    }
    const withData = [...groups.values()].filter(
      (g) => g.sameHousehold.length > 0 || g.sameFacility.length > 0,
    );
    console.log(`\n合計: ${withData.length}/${groups.size} 件に世帯/施設データあり`);
    process.exit(0);
  }

  // Firestoreに差分更新（merge: true で既存フィールドを保持）
  const db = getDB();
  const BATCH_LIMIT = 500;
  const now = Timestamp.now();
  let written = 0;
  const entries = [...groups.entries()];

  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = entries.slice(i, i + BATCH_LIMIT);

    for (const [id, { sameHousehold, sameFacility }] of chunk) {
      const ref = db.collection('customers').doc(id);
      batch.set(
        ref,
        {
          same_household_customer_ids: sameHousehold,
          same_facility_customer_ids: sameFacility,
          updated_at: now,
        },
        { merge: true },
      );
    }

    await batch.commit();
    written += chunk.length;
  }

  console.log(`✅ ${written} 件の customers を差分更新しました（same_household/facility_customer_ids）`);
  console.log('   ※ 他のコレクション（orders, travel_times 等）は変更していません');
  process.exit(0);
}

main().catch((err) => {
  console.error('Patch failed:', err);
  process.exit(1);
});
