import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  haversineDistance,
  estimateTravelMinutes,
  fetchTravelTimesFromGoogleMaps,
} from '../scripts/utils/google-maps-client.js';

describe('haversineDistance', () => {
  it('同一地点の距離は0', () => {
    expect(haversineDistance(31.584, 130.541, 31.584, 130.541)).toBe(0);
  });

  it('鹿児島中央駅→天文館の距離（約1.2km）', () => {
    // 鹿児島中央駅: 31.5840, 130.5413
    // 天文館: 31.5880, 130.5550
    const distance = haversineDistance(31.584, 130.5413, 31.588, 130.555);
    expect(distance).toBeGreaterThan(1000);
    expect(distance).toBeLessThan(2000);
  });

  it('大きな距離も計算可能（鹿児島→東京: 約960km）', () => {
    const distance = haversineDistance(31.584, 130.541, 35.6762, 139.6503);
    expect(distance).toBeGreaterThan(900_000);
    expect(distance).toBeLessThan(1_100_000);
  });
});

describe('estimateTravelMinutes', () => {
  it('0メートルの移動時間は0', () => {
    expect(estimateTravelMinutes(0)).toBe(0);
  });

  it('1000m → 市街地係数1.3 ÷ 40km/h ≒ 2.0分', () => {
    const minutes = estimateTravelMinutes(1000);
    expect(minutes).toBeCloseTo(2.0, 0);
  });

  it('10000m → 市街地係数1.3 ÷ 40km/h ≒ 19.5分', () => {
    const minutes = estimateTravelMinutes(10000);
    expect(minutes).toBeCloseTo(19.5, 0);
  });
});

describe('fetchTravelTimesFromGoogleMaps', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('API成功時に google_maps ソースで結果を返す', async () => {
    // 2地点の場合 → 2×2行列（対角線はスキップ）
    const mockResponse = {
      status: 'OK',
      rows: [
        {
          // A → [A, B]
          elements: [
            { status: 'OK', distance: { value: 0 }, duration: { value: 0 } }, // A→A (スキップ)
            { status: 'OK', distance: { value: 5000 }, duration: { value: 600 } }, // A→B: 10分
          ],
        },
        {
          // B → [A, B]
          elements: [
            { status: 'OK', distance: { value: 4800 }, duration: { value: 540 } }, // B→A: 9分
            { status: 'OK', distance: { value: 0 }, duration: { value: 0 } }, // B→B (スキップ)
          ],
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const locations = [
      { id: 'A', lat: 31.584, lng: 130.541 },
      { id: 'B', lat: 31.588, lng: 130.555 },
    ];

    const results = await fetchTravelTimesFromGoogleMaps('test-api-key', locations);

    expect(results).toHaveLength(2); // A→B and B→A
    const ab = results.find((r) => r.fromId === 'A' && r.toId === 'B');
    expect(ab).toBeDefined();
    expect(ab!.source).toBe('google_maps');
    expect(ab!.travelTimeMinutes).toBe(10);
    expect(ab!.distanceMeters).toBe(5000);

    const ba = results.find((r) => r.fromId === 'B' && r.toId === 'A');
    expect(ba).toBeDefined();
    expect(ba!.source).toBe('google_maps');
    expect(ba!.travelTimeMinutes).toBe(9);
  });

  it('API失敗時に Haversine フォールバック', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    const locations = [
      { id: 'A', lat: 31.584, lng: 130.541 },
      { id: 'B', lat: 31.588, lng: 130.555 },
    ];

    const results = await fetchTravelTimesFromGoogleMaps('invalid-key', locations);

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.source === 'dummy')).toBe(true);
  });

  it('個別ペアの NOT_FOUND は Haversine フォールバック', async () => {
    const mockResponse = {
      status: 'OK',
      rows: [
        {
          elements: [
            { status: 'NOT_FOUND' }, // B→NG
            {
              status: 'OK',
              distance: { value: 3000 },
              duration: { value: 300 },
            },
          ],
        },
        {
          elements: [
            {
              status: 'OK',
              distance: { value: 3000 },
              duration: { value: 300 },
            },
            { status: 'NOT_FOUND' }, // C→NG
          ],
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const locations = [
      { id: 'A', lat: 31.584, lng: 130.541 },
      { id: 'B', lat: 31.588, lng: 130.555 },
      { id: 'C', lat: 31.590, lng: 130.560 },
    ];

    const results = await fetchTravelTimesFromGoogleMaps('test-key', locations);

    const dummyResults = results.filter((r) => r.source === 'dummy');
    const gmapsResults = results.filter((r) => r.source === 'google_maps');

    expect(dummyResults.length).toBeGreaterThan(0);
    expect(gmapsResults.length).toBeGreaterThan(0);
  });

  it('transient エラー（429）はリトライ後フォールバック', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    const locations = [
      { id: 'A', lat: 31.584, lng: 130.541 },
      { id: 'B', lat: 31.588, lng: 130.555 },
    ];

    const results = await fetchTravelTimesFromGoogleMaps('test-key', locations);

    // リトライ後にフォールバック
    expect(results.every((r) => r.source === 'dummy')).toBe(true);
    // 3回リトライ（25×25バッチ単位で）
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBeGreaterThanOrEqual(3);
  }, 15000);
});
