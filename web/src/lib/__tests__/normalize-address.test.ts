import { describe, it, expect } from 'vitest';
import { normalizeAddress } from '../normalize-address';

describe('normalizeAddress', () => {
  it('全角英数字を半角に変換する', () => {
    expect(normalizeAddress('東京都新宿区１−２−３')).toBe('東京都新宿区1-2-3');
  });

  it('半角カナを全角カナに変換する', () => {
    expect(normalizeAddress('ｶﾅ町')).toBe('カナ町');
  });

  it('全角スペースを半角スペースに変換する', () => {
    expect(normalizeAddress('東京都　新宿区')).toBe('東京都 新宿区');
  });

  it('連続する空白を1つに統合する', () => {
    expect(normalizeAddress('東京都   新宿区')).toBe('東京都 新宿区');
  });

  it('前後の空白を除去する', () => {
    expect(normalizeAddress('  東京都新宿区  ')).toBe('東京都新宿区');
  });

  it('ハイフン系文字を統一する', () => {
    // 各種ハイフン: ‐ ― ー ‒ – — ﹣ －
    expect(normalizeAddress('1‐2')).toBe('1-2');
    expect(normalizeAddress('1―2')).toBe('1-2');
    expect(normalizeAddress('1ー2')).toBe('1-2');
    expect(normalizeAddress('1–2')).toBe('1-2');
    expect(normalizeAddress('1—2')).toBe('1-2');
    expect(normalizeAddress('1﹣2')).toBe('1-2');
    expect(normalizeAddress('1－2')).toBe('1-2');
    // U+2212 MINUS SIGN
    expect(normalizeAddress('1\u22122')).toBe('1-2');
  });

  it('複合的な正規化が正しく行われる', () => {
    expect(normalizeAddress('　東京都　新宿区１ー２ー３　')).toBe('東京都 新宿区1-2-3');
  });

  it('空文字列を処理できる', () => {
    expect(normalizeAddress('')).toBe('');
  });

  it('正規化不要な文字列はそのまま返す', () => {
    expect(normalizeAddress('東京都新宿区1-2-3')).toBe('東京都新宿区1-2-3');
  });

  it('Python版と同一の結果を返す（クロスプラットフォーム一貫性）', () => {
    // Python: unicodedata.normalize("NFKC", ...) と同一結果
    const cases = [
      ['大阪市北区１丁目２−３', '大阪市北区1丁目2-3'],
      ['ﾏﾝｼｮﾝ名　１０２号', 'マンション名 102号'],
      ['渋谷区神南１ー１ー１', '渋谷区神南1-1-1'],
    ];
    for (const [input, expected] of cases) {
      expect(normalizeAddress(input)).toBe(expected);
    }
  });
});
