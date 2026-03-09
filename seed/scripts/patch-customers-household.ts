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
import { normalizeAddress } from './utils/normalize-address.js';

const DATA_DIR = resolve(import.meta.dirname, '../data');

interface CustomerRow {
  id: string;
  address: string;
  household_id: string;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const customers = parseCSV<CustomerRow>(resolve(DATA_DIR, 'customers.csv'));

  // household_id → グループ構築
  const hhGroups: Record<string, string[]> = {};
  for (const c of customers) {
    if (c.household_id) {
      if (!hhGroups[c.household_id]) hhGroups[c.household_id] = [];
      hhGroups[c.household_id].push(c.id);
    }
  }

  // 住所ベースの同一施設グループ構築
  const addrGroups: Record<string, string[]> = {};
  for (const c of customers) {
    const norm = normalizeAddress(c.address);
    if (!addrGroups[norm]) addrGroups[norm] = [];
    addrGroups[norm].push(c.id);
  }

  // 各利用者の新フィールドを計算
  const updates: { id: string; sameHousehold: string[]; sameFacility: string[] }[] = [];
  for (const c of customers) {
    const sameHousehold = c.household_id
      ? (hhGroups[c.household_id] || []).filter((id) => id !== c.id)
      : [];
    const normAddr = normalizeAddress(c.address);
    const hhSet = new Set(sameHousehold);
    const sameFacility = (addrGroups[normAddr] || []).filter(
      (id) => id !== c.id && !hhSet.has(id),
    );
    updates.push({ id: c.id, sameHousehold, sameFacility });
  }

  if (dryRun) {
    console.log('🔍 Dry run — 以下のフィールドが更新されます:\n');
    for (const u of updates) {
      if (u.sameHousehold.length > 0 || u.sameFacility.length > 0) {
        console.log(`  ${u.id}:`);
        if (u.sameHousehold.length > 0)
          console.log(`    same_household_customer_ids: [${u.sameHousehold.join(', ')}]`);
        if (u.sameFacility.length > 0)
          console.log(`    same_facility_customer_ids: [${u.sameFacility.join(', ')}]`);
      }
    }
    const withData = updates.filter((u) => u.sameHousehold.length > 0 || u.sameFacility.length > 0);
    console.log(`\n合計: ${withData.length}/${updates.length} 件に世帯/施設データあり`);
    process.exit(0);
  }

  // Firestoreに差分更新（merge: true で既存フィールドを保持）
  const db = getDB();
  const BATCH_LIMIT = 500;
  const now = Timestamp.now();
  let written = 0;

  for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = updates.slice(i, i + BATCH_LIMIT);

    for (const u of chunk) {
      const ref = db.collection('customers').doc(u.id);
      batch.set(
        ref,
        {
          same_household_customer_ids: u.sameHousehold,
          same_facility_customer_ids: u.sameFacility,
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
