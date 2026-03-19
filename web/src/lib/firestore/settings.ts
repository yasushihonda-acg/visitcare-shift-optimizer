import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

export interface CuraImportSettings {
  spreadsheet_id: string;
}

const SETTINGS_COLLECTION = 'settings';
const CURA_IMPORT_DOC = 'cura_import';

export async function getCuraImportSettings(): Promise<CuraImportSettings | null> {
  const db = getDb();
  const ref = doc(db, SETTINGS_COLLECTION, CURA_IMPORT_DOC);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    spreadsheet_id: data.spreadsheet_id ?? '',
  };
}

export async function saveCuraImportSettings(
  spreadsheetId: string,
): Promise<void> {
  const db = getDb();
  const ref = doc(db, SETTINGS_COLLECTION, CURA_IMPORT_DOC);
  await setDoc(ref, {
    spreadsheet_id: spreadsheetId,
    updated_at: serverTimestamp(),
  });
}
