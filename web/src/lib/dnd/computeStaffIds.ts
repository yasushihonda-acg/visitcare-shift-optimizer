/**
 * D&Dドロップ後の新しい割当スタッフIDリストを計算する（純粋関数）。
 *
 * ロジック:
 * - sourceHelperId == targetId → 既存維持（時間変更のみ）
 * - targetId がすでに割当済み → 変更なし
 * - staff_count == 1 → [targetId]（置換）
 * - 空きあり (assigned.length < staffCount) → [...assigned, targetId]（追加）
 * - 満員 + sourceHelperId が割当に含まれる → sourceHelperIdをtargetIdに置換
 * - 満員 + sourceHelperId が割当に含まれない → 末尾に追加（フォールバック）
 */
export function computeNewStaffIds(
  currentAssigned: string[],
  targetId: string,
  sourceHelperId: string | null,
  staffCount: number,
): string[] {
  // 同一ヘルパー → 変更なし（時間変更のみのケース）
  if (sourceHelperId === targetId) {
    return [...currentAssigned];
  }

  // targetId がすでに割当済み → 変更なし（二重割当防止）
  if (currentAssigned.includes(targetId)) {
    return [...currentAssigned];
  }

  // staff_count=1 → 単純置換
  if (staffCount === 1) {
    return [targetId];
  }

  // 空きがある → 追加
  if (currentAssigned.length < staffCount) {
    return [...currentAssigned, targetId];
  }

  // 満員 + sourceHelperId が割当に含まれる → ソースを置換
  if (sourceHelperId !== null && currentAssigned.includes(sourceHelperId)) {
    return [...currentAssigned.filter((id) => id !== sourceHelperId), targetId];
  }

  // 満員 + sourceHelperId が割当に含まれない → 末尾に追加（フォールバック）
  return [...currentAssigned, targetId];
}
