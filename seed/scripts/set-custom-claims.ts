/**
 * Custom Claims 設定 CLI スクリプト
 *
 * 使い方:
 *   # ロール設定（admin / service_manager / helper）
 *   SEED_TARGET=production npx tsx scripts/set-custom-claims.ts --email user@example.com --role admin
 *
 *   # helperロール（helper_id 紐づけ）
 *   SEED_TARGET=production npx tsx scripts/set-custom-claims.ts --email helper@example.com --role helper --helper-id helper-001
 *
 *   # 現在のClaims確認
 *   SEED_TARGET=production npx tsx scripts/set-custom-claims.ts --email user@example.com --show
 *
 *   # Claims削除（ロール解除）
 *   SEED_TARGET=production npx tsx scripts/set-custom-claims.ts --email user@example.com --clear
 *
 * 環境変数:
 *   SEED_TARGET=production  → 本番 Firebase Auth（ADC使用）
 *   SEED_TARGET=emulator    → ローカル Emulator（デフォルト）
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const VALID_ROLES = ['admin', 'service_manager', 'helper'] as const;
type UserRole = (typeof VALID_ROLES)[number];

const SEED_TARGET = process.env.SEED_TARGET ?? 'emulator';
const PRODUCTION_PROJECT_ID = 'visitcare-shift-optimizer';

function initFirebase() {
  if (getApps().length > 0) return;

  if (SEED_TARGET === 'production') {
    console.log(`🔥 Connecting to PRODUCTION Firebase Auth (${PRODUCTION_PROJECT_ID})`);
    initializeApp({ projectId: PRODUCTION_PROJECT_ID });
  } else {
    if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    }
    console.log('🧪 Connecting to Emulator Firebase Auth');
    initializeApp({ projectId: 'demo-test' });
  }
}

function parseArgs(): {
  email: string;
  role?: UserRole;
  helperId?: string;
  show?: boolean;
  clear?: boolean;
} {
  const args = process.argv.slice(2);
  let email = '';
  let role: UserRole | undefined;
  let helperId: string | undefined;
  let show = false;
  let clear = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--email':
        email = args[++i];
        break;
      case '--role':
        role = args[++i] as UserRole;
        break;
      case '--helper-id':
        helperId = args[++i];
        break;
      case '--show':
        show = true;
        break;
      case '--clear':
        clear = true;
        break;
    }
  }

  if (!email) {
    console.error('❌ --email は必須です');
    console.error('');
    console.error('使い方:');
    console.error('  npx tsx scripts/set-custom-claims.ts --email user@example.com --role admin');
    console.error('  npx tsx scripts/set-custom-claims.ts --email user@example.com --show');
    console.error('  npx tsx scripts/set-custom-claims.ts --email user@example.com --clear');
    process.exit(1);
  }

  if (role && !VALID_ROLES.includes(role)) {
    console.error(`❌ 無効なロール: ${role}`);
    console.error(`   有効なロール: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  if (role === 'helper' && !helperId) {
    console.error('❌ helperロールには --helper-id が必須です');
    process.exit(1);
  }

  if (!role && !show && !clear) {
    console.error('❌ --role, --show, --clear のいずれかを指定してください');
    process.exit(1);
  }

  return { email, role, helperId, show, clear };
}

async function main() {
  const { email, role, helperId, show, clear } = parseArgs();

  initFirebase();
  const auth = getAuth();

  // ユーザー取得
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    console.error(`❌ ユーザーが見つかりません: ${email}`);
    console.error('   Firebase Authentication に登録済みのメールアドレスを指定してください');
    process.exit(1);
  }

  console.log(`👤 ユーザー: ${user.displayName ?? user.email} (uid: ${user.uid})`);

  // 現在のClaims表示
  if (show) {
    const current = user.customClaims ?? {};
    console.log('📋 現在の Custom Claims:');
    console.log(JSON.stringify(current, null, 2));
    return;
  }

  // Claims削除
  if (clear) {
    await auth.setCustomUserClaims(user.uid, {});
    console.log('🗑️  Custom Claims を削除しました');
    return;
  }

  // ロール設定
  const claims: Record<string, unknown> = { role };
  if (helperId) {
    claims.helper_id = helperId;
  }

  await auth.setCustomUserClaims(user.uid, claims);
  console.log(`✅ Custom Claims を設定しました:`);
  console.log(JSON.stringify(claims, null, 2));
  console.log('');
  console.log('⚠️  ユーザーは次回トークンリフレッシュ時（最大1時間）に反映されます');
  console.log('   即座に反映するには、ユーザーに再ログインを依頼してください');
}

main().catch((err) => {
  console.error('❌ エラー:', err);
  process.exit(1);
});
