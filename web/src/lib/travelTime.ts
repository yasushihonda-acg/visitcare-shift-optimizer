/**
 * travel_times コレクションのユーティリティ。
 *
 * FirestoreドキュメントID形式: `from_{fromCustomerId}_to_{toCustomerId}`
 * Lookupキー形式: `${fromId}_${toId}`
 */

/** ドキュメントIDをパース */
export function parseTravelTimeDocId(docId: string): { fromId: string; toId: string } | null {
  if (!docId.startsWith('from_')) return null;

  // "from_{fromId}_to_{toId}" の形式で "_to_" を区切りに分割
  const withoutPrefix = docId.slice('from_'.length); // "{fromId}_to_{toId}"
  const separator = '_to_';
  const sepIndex = withoutPrefix.indexOf(separator);
  if (sepIndex === -1) return null;

  const fromId = withoutPrefix.slice(0, sepIndex);
  const toId = withoutPrefix.slice(sepIndex + separator.length);

  // 空文字は無効
  if (!fromId || !toId) return null;

  return { fromId, toId };
}

/** Firestoreドキュメント配列からlookup Mapを構築 */
export function buildTravelTimeLookup(
  docs: Array<{ id: string; travel_time_minutes: number }>,
): Map<string, number> {
  const lookup = new Map<string, number>();
  for (const doc of docs) {
    const parsed = parseTravelTimeDocId(doc.id);
    if (!parsed) continue;
    lookup.set(`${parsed.fromId}_${parsed.toId}`, doc.travel_time_minutes);
  }
  return lookup;
}

/**
 * 2地点間の移動時間（分）を取得。
 * - 同一地点 → 0
 * - A→B データがなければ B→A を試みる（双方向検索）
 * - データなし → null
 */
export function getTravelMinutes(
  lookup: Map<string, number>,
  fromCustomerId: string,
  toCustomerId: string,
): number | null {
  if (fromCustomerId === toCustomerId) return 0;

  const forward = lookup.get(`${fromCustomerId}_${toCustomerId}`);
  if (forward != null) return forward;

  const backward = lookup.get(`${toCustomerId}_${fromCustomerId}`);
  if (backward != null) return backward;

  return null;
}
