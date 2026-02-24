/**
 * 本番 Firestore 移行スクリプト: preferred_staff_ids → allowed_staff_ids
 *
 * 移行ルール:
 *   - allowed_staff_ids フィールドが未設定のドキュメントのみ対象（冪等）
 *   - preferred_staff_ids の値を allowed_staff_ids にコピー
 *   - preferred_staff_ids はそのまま維持
 *
 * 使用方法:
 *   # dry-run（実際には書き込まない）
 *   SEED_TARGET=production npx tsx seed/scripts/migrate-preferred-to-allowed.ts --dry-run
 *
 *   # 本番実行
 *   SEED_TARGET=production npx tsx seed/scripts/migrate-preferred-to-allowed.ts
 *
 * ロールバック:
 *   allowed_staff_ids フィールドを削除するだけで元の状態に戻る:
 *   customers コレクションの各ドキュメントから allowed_staff_ids を FieldValue.delete() で削除
 */

import { FieldValue } from 'firebase-admin/firestore';
import { getDB } from './utils/firestore-client.js';

const isDryRun = process.argv.includes('--dry-run');

async function migrate() {
  const db = getDB();
  const snapshot = await db.collection('customers').get();

  let skipped = 0;
  let migrated = 0;
  let noPreferred = 0;

  const updates: Array<{ id: string; allowedStaffIds: string[] }> = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const preferredStaffIds: string[] = data.preferred_staff_ids ?? [];

    // allowed_staff_ids フィールドが既に存在する場合はスキップ（冪等）
    if (data.allowed_staff_ids !== undefined) {
      skipped++;
      continue;
    }

    if (preferredStaffIds.length === 0) {
      noPreferred++;
      // preferred がなくても allowed_staff_ids: [] を書き込む（フィールド統一のため）
      updates.push({ id: doc.id, allowedStaffIds: [] });
      continue;
    }

    updates.push({ id: doc.id, allowedStaffIds: preferredStaffIds });
    migrated++;
  }

  console.log(`\n📊 移行サマリー (${isDryRun ? 'DRY-RUN' : '本番実行'})`);
  console.log(`  対象ドキュメント総数: ${snapshot.size}`);
  console.log(`  移行対象 (preferred→allowed): ${migrated}`);
  console.log(`  空フィールド初期化 (preferred なし): ${noPreferred}`);
  console.log(`  スキップ (allowed_staff_ids 既存): ${skipped}`);

  if (updates.length > 0) {
    console.log('\n📋 移行対象一覧:');
    for (const u of updates) {
      if (u.allowedStaffIds.length > 0) {
        console.log(`  ${u.id}: ${u.allowedStaffIds.join(', ')} → allowed`);
      }
    }
  }

  if (isDryRun) {
    console.log('\n⏭️  DRY-RUN モード: 書き込みをスキップしました');
    console.log('本番実行するには --dry-run フラグを外してください');
    return;
  }

  if (updates.length === 0) {
    console.log('\n✅ 移行対象なし（全ドキュメント処理済みまたはデータなし）');
    return;
  }

  // バッチ書き込み（500件制限を自動分割）
  const BATCH_LIMIT = 500;
  let written = 0;

  for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = updates.slice(i, i + BATCH_LIMIT);

    for (const u of chunk) {
      const ref = db.collection('customers').doc(u.id);
      batch.update(ref, { allowed_staff_ids: u.allowedStaffIds });
    }

    await batch.commit();
    written += chunk.length;
  }

  console.log(`\n✅ 移行完了: ${written} ドキュメントを更新しました`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().catch((err) => {
    console.error('❌ 移行エラー:', err);
    process.exit(1);
  });
}
