import { resolve } from 'path';
import { Timestamp } from 'firebase-admin/firestore';
import { parseCSV } from './utils/csv-parser.js';
import { batchWrite } from './utils/firestore-client.js';

const DATA_DIR = resolve(import.meta.dirname, '../data');

/**
 * Haversine距離（メートル）
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000; // 地球の半径（m）
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * 直線距離から移動時間を算出（市街地係数 1.3、平均速度 40km/h）
 */
function estimateTravelMinutes(distanceMeters: number): number {
  const CITY_FACTOR = 1.3;
  const SPEED_KMH = 40;
  const actualDistance = distanceMeters * CITY_FACTOR;
  return Math.round((actualDistance / 1000 / SPEED_KMH) * 60 * 10) / 10;
}

interface LocationRow {
  id: string;
  lat: string;
  lng: string;
}

export async function generateTravelTimes(): Promise<number> {
  // 利用者とヘルパーの座標を収集
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

  const now = Timestamp.now();
  const docs: { id: string; data: Record<string, unknown> }[] = [];

  // 全ペア間の移動時間を計算
  for (let i = 0; i < locations.length; i++) {
    for (let j = 0; j < locations.length; j++) {
      if (i === j) continue;

      const from = locations[i];
      const to = locations[j];
      const distance = haversineDistance(from.lat, from.lng, to.lat, to.lng);
      const travelMinutes = estimateTravelMinutes(distance);

      docs.push({
        id: `from_${from.id}_to_${to.id}`,
        data: {
          from_location: { lat: from.lat, lng: from.lng },
          to_location: { lat: to.lat, lng: to.lng },
          travel_time_minutes: travelMinutes,
          distance_meters: Math.round(distance),
          source: 'dummy',
          cached_at: now,
        },
      });
    }
  }

  return batchWrite('travel_times', docs);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateTravelTimes().then((count) => {
    console.log(`Generated ${count} travel time records`);
    process.exit(0);
  });
}
