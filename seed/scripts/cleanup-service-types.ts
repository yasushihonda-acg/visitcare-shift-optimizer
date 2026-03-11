/**
 * 本番Firestoreのservice_typesコレクションから、
 * CSVに存在しないドキュメントを削除するスクリプト。
 *
 * 使い方:
 *   SEED_TARGET=production npx tsx scripts/cleanup-service-types.ts [--dry-run]
 */
import { resolve } from 'path';
import { getDB } from './utils/firestore-client.js';
import { parseCSV } from './utils/csv-parser.js';

const DATA_DIR = resolve(import.meta.dirname, '../data');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const rows = parseCSV<{ code: string }>(resolve(DATA_DIR, 'service-types.csv'));
  const keepCodes = new Set(rows.map((r) => r.code));

  const db = getDB();
  const snap = await db.collection('service_types').get();
  const toDelete = snap.docs.filter((d) => !keepCodes.has(d.id));

  console.log(`Total in Firestore: ${snap.size}`);
  console.log(`Keep (in CSV): ${snap.size - toDelete.length}`);
  console.log(`To delete: ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    process.exit(0);
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Would delete:');
    for (const doc of toDelete) {
      console.log(`  - ${doc.id}`);
    }
    process.exit(0);
  }

  const BATCH_LIMIT = 500;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + BATCH_LIMIT);
    for (const doc of chunk) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += chunk.length;
  }

  console.log(`Deleted ${deleted} documents.`);
  process.exit(0);
}

main();
