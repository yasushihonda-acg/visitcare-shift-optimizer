import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore, WriteBatch } from 'firebase-admin/firestore';

let db: Firestore;

const SEED_TARGET = process.env.SEED_TARGET ?? 'emulator';
const PRODUCTION_PROJECT_ID = 'visitcare-shift-optimizer';

/**
 * Firestore Admin SDKを初期化
 * SEED_TARGET=production → 本番Firestore（Application Default Credentials使用）
 * SEED_TARGET=emulator（デフォルト） → ローカルEmulator
 */
export function getDB(): Firestore {
  if (db) return db;

  if (SEED_TARGET === 'production') {
    console.log(`🔥 Connecting to PRODUCTION Firestore (${PRODUCTION_PROJECT_ID})`);
    if (getApps().length === 0) {
      initializeApp({ projectId: PRODUCTION_PROJECT_ID });
    }
  } else {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    }
    if (getApps().length === 0) {
      initializeApp({ projectId: 'visitcare-shift-optimizer' });
    }
  }

  db = getFirestore();
  return db;
}

/**
 * バッチ書き込みヘルパー（500件制限を自動分割）
 */
export async function batchWrite(
  collectionName: string,
  docs: { id: string; data: Record<string, unknown> }[],
): Promise<number> {
  const db = getDB();
  const BATCH_LIMIT = 500;
  let written = 0;

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch: WriteBatch = db.batch();
    const chunk = docs.slice(i, i + BATCH_LIMIT);

    for (const doc of chunk) {
      const ref = db.collection(collectionName).doc(doc.id);
      batch.set(ref, doc.data);
    }

    await batch.commit();
    written += chunk.length;
  }

  return written;
}

/**
 * コレクション内の全ドキュメントを削除
 */
export async function clearCollection(collectionName: string): Promise<number> {
  const db = getDB();
  const snapshot = await db.collection(collectionName).get();

  if (snapshot.empty) return 0;

  const BATCH_LIMIT = 500;
  let deleted = 0;

  for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);

    for (const doc of chunk) {
      batch.delete(doc.ref);
    }

    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}
