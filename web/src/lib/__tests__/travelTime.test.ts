import { describe, it, expect } from 'vitest';
import { parseTravelTimeDocId, buildTravelTimeLookup, getTravelMinutes } from '../travelTime';

// --- parseTravelTimeDocId ---

describe('parseTravelTimeDocId', () => {
  it('正常系: from_{A}_to_{B} → { fromId, toId }', () => {
    const result = parseTravelTimeDocId('from_cust001_to_cust002');
    expect(result).toEqual({ fromId: 'cust001', toId: 'cust002' });
  });

  it('正常系: IDにハイフンを含む', () => {
    const result = parseTravelTimeDocId('from_cust-001_to_cust-002');
    expect(result).toEqual({ fromId: 'cust-001', toId: 'cust-002' });
  });

  it('異常系: from_ プレフィックスなし → null', () => {
    const result = parseTravelTimeDocId('cust001_to_cust002');
    expect(result).toBeNull();
  });

  it('異常系: _to_ セパレータなし → null', () => {
    const result = parseTravelTimeDocId('from_cust001_cust002');
    expect(result).toBeNull();
  });

  it('異常系: 空文字 → null', () => {
    const result = parseTravelTimeDocId('');
    expect(result).toBeNull();
  });

  it('異常系: from_ のみ → null', () => {
    const result = parseTravelTimeDocId('from__to_');
    // from と to が空文字の場合はnull
    expect(result).toBeNull();
  });

  it('正常系: IDに数字のみ', () => {
    const result = parseTravelTimeDocId('from_123_to_456');
    expect(result).toEqual({ fromId: '123', toId: '456' });
  });
});

// --- buildTravelTimeLookup ---

describe('buildTravelTimeLookup', () => {
  it('複数のドキュメントからlookupを構築', () => {
    const docs = [
      { id: 'from_A_to_B', travel_time_minutes: 10 },
      { id: 'from_B_to_C', travel_time_minutes: 20 },
    ];
    const lookup = buildTravelTimeLookup(docs);
    expect(lookup.get('A_B')).toBe(10);
    expect(lookup.get('B_C')).toBe(20);
  });

  it('無効なドキュメントIDはスキップ', () => {
    const docs = [
      { id: 'from_A_to_B', travel_time_minutes: 10 },
      { id: 'invalid-id', travel_time_minutes: 5 },
    ];
    const lookup = buildTravelTimeLookup(docs);
    expect(lookup.size).toBe(1);
    expect(lookup.get('A_B')).toBe(10);
  });

  it('空配列 → 空のMap', () => {
    const lookup = buildTravelTimeLookup([]);
    expect(lookup.size).toBe(0);
  });
});

// --- getTravelMinutes ---

describe('getTravelMinutes', () => {
  const lookup = new Map([
    ['A_B', 10],
    ['C_D', 25],
  ]);

  it('A→B の移動時間を返す', () => {
    expect(getTravelMinutes(lookup, 'A', 'B')).toBe(10);
  });

  it('双方向検索: B→A も10分を返す（A→Bのデータから）', () => {
    expect(getTravelMinutes(lookup, 'B', 'A')).toBe(10);
  });

  it('データなし → null を返す', () => {
    expect(getTravelMinutes(lookup, 'X', 'Y')).toBeNull();
  });

  it('同一利用者（A→A）→ 0 を返す', () => {
    expect(getTravelMinutes(lookup, 'A', 'A')).toBe(0);
  });

  it('C→D の移動時間を返す', () => {
    expect(getTravelMinutes(lookup, 'C', 'D')).toBe(25);
  });

  it('D→C の双方向検索', () => {
    expect(getTravelMinutes(lookup, 'D', 'C')).toBe(25);
  });
});
