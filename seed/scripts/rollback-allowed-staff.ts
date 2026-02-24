/**
 * 本番 Firestore ロールバックスクリプト: allowed_staff_ids を空配列にリセット
 *
 * 背景:
 *   migrate-preferred-to-allowed.ts により preferred_staff_ids → allowed_staff_ids に
 *   コピーしたが、allowed_staff_ids はハード制約（絶対禁止）であるため、
 *   preferred ヘルパーが不在の日に Infeasible が発生した。
 *
 * ロールバック内容:
 *   - 全 customers ドキュメントの allowed_staff_ids を [] にリセット
 *   - preferred_staff_ids はそのまま維持（ソフト制約として引き続き機能）
 *
 * 使用方法:
 *   # dry-run（実際には書き込まない）
 *   SEED_TARGET=production npx tsx seed/scripts/rollback-allowed-staff.ts --dry-run
 *
 *   # 本番実行
 *   SEED_TARGET=production npx tsx seed/scripts/rollback-allowed-staff.ts
 */

import { getDB } from './utils/firestore-client.js';

const isDryRun = process.argv.includes('--dry-run');

async function rollback() {
  const db = getDB();
  const snapshot = await db.collection('customers').get();

  let skipped = 0;
  let reset = 0;
  const targets: string[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const allowedStaffIds: string[] = data.allowed_staff_ids ?? [];

    // すでに空ならスキップ
    if (allowedStaffIds.length === 0) {
      skipped++;
      continue;
    }

    targets.push(doc.id);
    reset++;
  }

  console.log(`\n📊 ロールバックサマリー (${isDryRun ? 'DRY-RUN' : '本番実行'})`);
  console.log(`  対象ドキュメント総数: ${snapshot.size}`);
  console.log(`  リセット対象 (allowed_staff_ids が非空): ${reset}`);
  console.log(`  スキップ (already empty): ${skipped}`);

  if (targets.length > 0) {
    console.log('\n📋 リセット対象一覧:');
    for (const id of targets) {
      const doc = snapshot.docs.find((d) => d.id === id)!;
      const allowed: string[] = doc.data().allowed_staff_ids ?? [];
      console.log(`  ${id}: ${allowed.join(', ')} → []`);
    }
  }

  if (isDryRun) {
    console.log('\n⏭️  DRY-RUN モード: 書き込みをスキップしました');
    console.log('本番実行するには --dry-run フラグを外してください');
    return;
  }

  if (targets.length === 0) {
    console.log('\n✅ リセット対象なし（全ドキュメント既に空）');
    return;
  }

  // バッチ書き込み（500件制限を自動分割）
  const BATCH_LIMIT = 500;
  let written = 0;

  for (let i = 0; i < targets.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = targets.slice(i, i + BATCH_LIMIT);

    for (const id of chunk) {
      const ref = db.collection('customers').doc(id);
      batch.update(ref, { allowed_staff_ids: [] });
    }

    await batch.commit();
    written += chunk.length;
  }

  console.log(`\n✅ ロールバック完了: ${written} ドキュメントを allowed_staff_ids: [] にリセットしました`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  rollback().catch((err) => {
    console.error('❌ ロールバックエラー:', err);
    process.exit(1);
  });
}
