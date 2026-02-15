import { resolve } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { parseCSV } from './utils/csv-parser.js';
import { batchWrite, getDB } from './utils/firestore-client.js';
import {
  fetchTravelTimesFromGoogleMaps,
  haversineDistance,
  estimateTravelMinutes,
  type TravelTimeResult,
} from './utils/google-maps-client.js';

const DATA_DIR = resolve(import.meta.dirname, '../data');

/** キャッシュ有効期間（30日） */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface LocationRow {
  id: string;
  lat: string;
  lng: string;
}

/**
 * Firestore 内の有効キャッシュ済みドキュメントIDを取得
 */
async function loadCachedIds(): Promise<Set<string>> {
  const db = getDB();
  const now = Date.now();
  const snapshot = await db.collection('travel_times').get();
  const cached = new Set<string>();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.source === 'google_maps' && data.cached_at) {
      const cachedAt = data.cached_at.toMillis?.() ?? data.cached_at;
      if (now - cachedAt < CACHE_TTL_MS) {
        cached.add(doc.id);
      }
    }
  }
  return cached;
}

/**
 * 全ペア間の移動時間を Haversine 推定で生成
 */
function generateHaversineTravelTimes(
  locations: { id: string; lat: number; lng: number }[],
): TravelTimeResult[] {
  const results: TravelTimeResult[] = [];
  for (let i = 0; i < locations.length; i++) {
    for (let j = 0; j < locations.length; j++) {
      if (i === j) continue;
      const from = locations[i];
      const to = locations[j];
      const distance = haversineDistance(from.lat, from.lng, to.lat, to.lng);
      results.push({
        fromId: from.id,
        toId: to.id,
        travelTimeMinutes: estimateTravelMinutes(distance),
        distanceMeters: Math.round(distance),
        source: 'dummy',
      });
    }
  }
  return results;
}

export async function generateTravelTimes(): Promise<number> {
  const customers = parseCSV<LocationRow & { [key: string]: string }>(
    resolve(DATA_DIR, 'customers.csv'),
  );

  // ヘルパーは事業所起点（鹿児島中央駅付近: 31.5840, 130.5413）
  const OFFICE_LOCATION = { lat: 31.5840, lng: 130.5413 };

  const locations: { id: string; lat: number; lng: number }[] = [];

  // 事業所
  locations.push({ id: 'OFFICE', lat: OFFICE_LOCATION.lat, lng: OFFICE_LOCATION.lng });

  // 全利用者
  for (const c of customers) {
    locations.push({ id: c.id, lat: parseFloat(c.lat), lng: parseFloat(c.lng) });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  let travelResults: TravelTimeResult[];

  if (apiKey) {
    console.log('🗺️  Google Maps Distance Matrix API を使用...');

    // キャッシュ済みのペアを除外
    const cachedIds = await loadCachedIds();
    const uncachedLocations = locations.filter((loc) => {
      // このロケーションが含まれるペアのうち、1つでも未キャッシュがあればinclude
      return locations.some((other) => {
        if (loc.id === other.id) return false;
        const id1 = `from_${loc.id}_to_${other.id}`;
        const id2 = `from_${other.id}_to_${loc.id}`;
        return !cachedIds.has(id1) || !cachedIds.has(id2);
      });
    });

    if (uncachedLocations.length === 0) {
      console.log('✅ 全ペアがキャッシュ済み（有効期限内）');
      return 0;
    }

    console.log(
      `📍 ${uncachedLocations.length}/${locations.length} 地点の移動時間を取得中...`,
    );

    try {
      travelResults = await fetchTravelTimesFromGoogleMaps(apiKey, uncachedLocations);
      const gmapsCount = travelResults.filter((r) => r.source === 'google_maps').length;
      const dummyCount = travelResults.filter((r) => r.source === 'dummy').length;
      console.log(`✅ API取得: ${gmapsCount}件, Haversineフォールバック: ${dummyCount}件`);
    } catch (error) {
      console.error('❌ Google Maps API 全体エラー → Haversine にフォールバック:', error);
      travelResults = generateHaversineTravelTimes(locations);
    }
  } else {
    console.log('⚠️  GOOGLE_MAPS_API_KEY 未設定 → Haversine 推定値を使用');
    travelResults = generateHaversineTravelTimes(locations);
  }

  // Firestore ドキュメントに変換
  const now = Timestamp.now();
  const docs = travelResults.map((r) => {
    const fromLoc = locations.find((l) => l.id === r.fromId)!;
    const toLoc = locations.find((l) => l.id === r.toId)!;
    return {
      id: `from_${r.fromId}_to_${r.toId}`,
      data: {
        from_location: { lat: fromLoc.lat, lng: fromLoc.lng },
        to_location: { lat: toLoc.lat, lng: toLoc.lng },
        travel_time_minutes: r.travelTimeMinutes,
        distance_meters: r.distanceMeters,
        source: r.source,
        cached_at: now,
      },
    };
  });

  return batchWrite('travel_times', docs);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateTravelTimes().then((count) => {
    console.log(`Generated ${count} travel time records`);
    process.exit(0);
  });
}
