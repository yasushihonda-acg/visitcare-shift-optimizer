import { Timestamp } from 'firebase-admin/firestore';
import { GeoLocation, TravelTimeSource } from './common';

/** 移動時間（ペア間） */
export interface TravelTime {
  id: string;
  from_location: GeoLocation;
  to_location: GeoLocation;
  travel_time_minutes: number;
  distance_meters: number;
  source: TravelTimeSource;
  cached_at: Timestamp;
}
