/**
 * Google Maps Distance Matrix API クライアント
 *
 * - Batch処理: origins × destinations を最大25×25で分割
 * - エラー分類: transient(429/503) → リトライ, permanent(400/403) → スキップ
 * - フォールバック: API KEY 未設定時は Haversine 推定値を返す
 */

/** Distance Matrix API レスポンス型 */
interface DistanceMatrixResponse {
  rows: Array<{
    elements: Array<{
      status: 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS' | 'MAX_ROUTE_LENGTH_EXCEEDED';
      distance?: { value: number }; // meters
      duration?: { value: number }; // seconds
    }>;
  }>;
  status: string;
  error_message?: string;
}

export interface TravelTimeResult {
  fromId: string;
  toId: string;
  travelTimeMinutes: number;
  distanceMeters: number;
  source: 'google_maps' | 'dummy';
}

interface Location {
  id: string;
  lat: number;
  lng: number;
}

/** Distance Matrix API の1リクエストあたりの最大 origins/destinations 数 */
const MAX_ELEMENTS_PER_REQUEST = 25;

/** リトライ設定 */
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

/**
 * Google Maps Distance Matrix API を呼び出し、全ペア間の移動時間を取得
 */
export async function fetchTravelTimesFromGoogleMaps(
  apiKey: string,
  locations: Location[],
): Promise<TravelTimeResult[]> {
  const results: TravelTimeResult[] = [];

  // origins × destinations を MAX_ELEMENTS_PER_REQUEST ずつ分割してバッチ処理
  for (let oi = 0; oi < locations.length; oi += MAX_ELEMENTS_PER_REQUEST) {
    const originBatch = locations.slice(oi, oi + MAX_ELEMENTS_PER_REQUEST);

    for (let di = 0; di < locations.length; di += MAX_ELEMENTS_PER_REQUEST) {
      const destBatch = locations.slice(di, di + MAX_ELEMENTS_PER_REQUEST);

      const batchResults = await callDistanceMatrixWithRetry(
        apiKey,
        originBatch,
        destBatch,
      );
      results.push(...batchResults);
    }
  }

  return results;
}

/**
 * Distance Matrix API 呼び出し（リトライ付き）
 */
async function callDistanceMatrixWithRetry(
  apiKey: string,
  origins: Location[],
  destinations: Location[],
): Promise<TravelTimeResult[]> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callDistanceMatrix(apiKey, origins, destinations);
    } catch (error: unknown) {
      const isTransient = isTransientError(error);
      if (!isTransient || attempt === MAX_RETRIES - 1) {
        console.error(
          `Distance Matrix API error (attempt ${attempt + 1}/${MAX_RETRIES}):`,
          error instanceof Error ? error.message : error,
        );
        // permanent error or max retries → Haversine フォールバック
        return fallbackToHaversine(origins, destinations);
      }
      const backoff = INITIAL_BACKOFF_MS * 2 ** attempt;
      console.warn(`Transient error, retrying in ${backoff}ms...`);
      await sleep(backoff);
    }
  }
  return fallbackToHaversine(origins, destinations);
}

/**
 * Distance Matrix API 呼び出し（単一リクエスト）
 */
async function callDistanceMatrix(
  apiKey: string,
  origins: Location[],
  destinations: Location[],
): Promise<TravelTimeResult[]> {
  const originsParam = origins.map((l) => `${l.lat},${l.lng}`).join('|');
  const destsParam = destinations.map((l) => `${l.lat},${l.lng}`).join('|');

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  url.searchParams.set('origins', originsParam);
  url.searchParams.set('destinations', destsParam);
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('language', 'ja');
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString());

  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
    (err as Error & { statusCode: number }).statusCode = response.status;
    throw err;
  }

  const data: DistanceMatrixResponse = await response.json();

  if (data.status !== 'OK') {
    const err = new Error(`API error: ${data.status} - ${data.error_message ?? ''}`);
    (err as Error & { apiStatus: string }).apiStatus = data.status;
    throw err;
  }

  const results: TravelTimeResult[] = [];

  for (let i = 0; i < origins.length; i++) {
    for (let j = 0; j < destinations.length; j++) {
      // 自分自身へのペアはスキップ
      if (origins[i].id === destinations[j].id) continue;

      const element = data.rows[i]?.elements[j];
      if (!element || element.status !== 'OK') {
        // 個別ペアが取得失敗 → Haversine フォールバック
        const distance = haversineDistance(
          origins[i].lat, origins[i].lng,
          destinations[j].lat, destinations[j].lng,
        );
        results.push({
          fromId: origins[i].id,
          toId: destinations[j].id,
          travelTimeMinutes: estimateTravelMinutes(distance),
          distanceMeters: Math.round(distance),
          source: 'dummy',
        });
        continue;
      }

      results.push({
        fromId: origins[i].id,
        toId: destinations[j].id,
        travelTimeMinutes: Math.round((element.duration!.value / 60) * 10) / 10,
        distanceMeters: element.distance!.value,
        source: 'google_maps',
      });
    }
  }

  return results;
}

/**
 * Transient エラー判定
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode;
    if (statusCode === 429 || statusCode === 503) return true;
    const apiStatus = (error as Error & { apiStatus?: string }).apiStatus;
    if (apiStatus === 'OVER_QUERY_LIMIT') return true;
    if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNRESET')) {
      return true;
    }
  }
  return false;
}

/**
 * Haversine距離によるフォールバック
 */
function fallbackToHaversine(
  origins: Location[],
  destinations: Location[],
): TravelTimeResult[] {
  const results: TravelTimeResult[] = [];
  for (const origin of origins) {
    for (const dest of destinations) {
      if (origin.id === dest.id) continue;
      const distance = haversineDistance(origin.lat, origin.lng, dest.lat, dest.lng);
      results.push({
        fromId: origin.id,
        toId: dest.id,
        travelTimeMinutes: estimateTravelMinutes(distance),
        distanceMeters: Math.round(distance),
        source: 'dummy',
      });
    }
  }
  return results;
}

/**
 * Haversine距離（メートル）
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
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
export function estimateTravelMinutes(distanceMeters: number): number {
  const CITY_FACTOR = 1.3;
  const SPEED_KMH = 40;
  const actualDistance = distanceMeters * CITY_FACTOR;
  return Math.round((actualDistance / 1000 / SPEED_KMH) * 60 * 10) / 10;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
