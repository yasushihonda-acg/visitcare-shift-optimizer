import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

// ── 旧API（後方互換） ──────────────────────────────────────

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

// ── 複数インポートソース管理 ──────────────────────────────────

export type ImportSourceKey = 'cura_note' | 'fusen' | 'checklist';

export interface ImportSource {
  key: ImportSourceKey;
  label: string;
  spreadsheet_id: string;
}

export const IMPORT_SOURCE_LABELS: Record<ImportSourceKey, string> = {
  cura_note: 'CURAノート',
  fusen: 'ふせん',
  checklist: 'チェックリスト',
};

const NOTE_SOURCES_DOC = 'note_import_sources';

export async function getImportSources(): Promise<ImportSource[]> {
  const db = getDb();
  const ref = doc(db, SETTINGS_COLLECTION, NOTE_SOURCES_DOC);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // 旧設定からの移行: cura_import に値があればそれを使う
    const legacy = await getCuraImportSettings();
    if (legacy?.spreadsheet_id) {
      return [{ key: 'cura_note', label: IMPORT_SOURCE_LABELS.cura_note, spreadsheet_id: legacy.spreadsheet_id }];
    }
    return [];
  }
  const data = snap.data();
  const sources: ImportSource[] = [];
  for (const key of Object.keys(IMPORT_SOURCE_LABELS) as ImportSourceKey[]) {
    if (data[key]) {
      sources.push({ key, label: IMPORT_SOURCE_LABELS[key], spreadsheet_id: data[key] });
    }
  }
  return sources;
}

export async function saveImportSource(
  key: ImportSourceKey,
  spreadsheetId: string,
): Promise<void> {
  const db = getDb();
  const ref = doc(db, SETTINGS_COLLECTION, NOTE_SOURCES_DOC);
  await setDoc(ref, {
    [key]: spreadsheetId,
    updated_at: serverTimestamp(),
  }, { merge: true });
}
