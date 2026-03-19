import type { PersonName } from '@/types';

/** フルネーム表示（スペース区切り）: "山田 太郎" */
export function formatFullName(name: PersonName): string {
  return `${name.family} ${name.given}`;
}

/** コンパクト表示（スペースなし）: "山田太郎" */
export function formatCompactName(name: PersonName): string {
  return `${name.family}${name.given}`;
}

/** 表示名（short優先、フォールバック: コンパクト名）: "太郎" or "山田太郎" */
export function formatDisplayName(name: PersonName): string {
  return name.short ?? formatCompactName(name);
}

/** フルネーム（カナ）: "ヤマダ タロウ"。未設定時は空文字 */
export function formatFullNameKana(name: PersonName): string {
  return `${name.family_kana ?? ''} ${name.given_kana ?? ''}`.trim();
}
