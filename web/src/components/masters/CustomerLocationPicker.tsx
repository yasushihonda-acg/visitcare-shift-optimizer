'use client';

import { useCallback, useEffect, useMemo } from 'react';
import {
  Map,
  AdvancedMarker,
  useMap,
} from '@vis.gl/react-google-maps';

/** 鹿児島市中心部（デフォルト位置） */
const DEFAULT_CENTER = { lat: 31.5916, lng: 130.5571 };
const DEFAULT_ZOOM = 15;

interface CustomerLocationPickerProps {
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number) => void;
}

function isValidLocation(lat: number, lng: number): boolean {
  return lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng);
}

export function CustomerLocationPicker({
  lat,
  lng,
  onLocationChange,
}: CustomerLocationPickerProps) {
  const map = useMap();
  const hasValidLocation = isValidLocation(lat, lng);

  const center = useMemo(
    () => (hasValidLocation ? { lat, lng } : DEFAULT_CENTER),
    [hasValidLocation, lat, lng]
  );

  // 座標が外部から変わったらマップの中心を追従
  useEffect(() => {
    if (map && hasValidLocation) {
      map.panTo({ lat, lng });
    }
  }, [map, lat, lng, hasValidLocation]);

  const handleDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        onLocationChange(
          Math.round(e.latLng.lat() * 1e6) / 1e6,
          Math.round(e.latLng.lng() * 1e6) / 1e6
        );
      }
    },
    [onLocationChange]
  );

  return (
    <div className="h-[200px] w-full overflow-hidden rounded-md border">
      <Map
        defaultCenter={center}
        defaultZoom={DEFAULT_ZOOM}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID}
        gestureHandling="cooperative"
        disableDefaultUI
        zoomControl
      >
        <AdvancedMarker
          position={center}
          draggable
          onDragEnd={handleDragEnd}
        />
      </Map>
    </div>
  );
}
