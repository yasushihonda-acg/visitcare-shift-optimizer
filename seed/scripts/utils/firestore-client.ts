import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore, WriteBatch } from 'firebase-admin/firestore';

let db: Firestore;

/**
 * Firestore Admin SDKを初期化（Emulator対応）
 */
export function getDB(): Firestore {
  if (db) return db;

  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  }

  if (getApps().length === 0) {
    initializeApp({ projectId: 'demo-test' });
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
