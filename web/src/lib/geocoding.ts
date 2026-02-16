/**
 * Google Maps JavaScript API Geocoding Service を使用した住所→座標変換
 * Static Export制約のため、クライアントサイドで実行
 */

export interface GeocodingResult {
  lat: number;
  lng: number;
}

/**
 * 住所文字列から緯度経度を取得する
 * @returns 座標、または見つからない場合は null
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodingResult | null> {
  if (!address.trim()) return null;

  if (typeof google === 'undefined' || !google.maps) {
    console.error('Google Maps JavaScript API is not loaded');
    return null;
  }

  const geocoder = new google.maps.Geocoder();

  try {
    const response = await geocoder.geocode({
      address,
      region: 'jp',
    });

    if (response.results.length === 0) return null;

    const location = response.results[0].geometry.location;
    return {
      lat: location.lat(),
      lng: location.lng(),
    };
  } catch {
    return null;
  }
}
