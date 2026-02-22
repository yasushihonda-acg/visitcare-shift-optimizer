'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { buildTravelTimeLookup } from '@/lib/travelTime';

/**
 * Firestore travel_times コレクションを一括取得し、
 * `${fromId}_${toId}` をキーとする移動時間（分）の Map を返す。
 *
 * 変更頻度が低いため onSnapshot ではなく getDocs で取得。
 */
export function useTravelTimes() {
  const [travelTimeLookup, setTravelTimeLookup] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    getDocs(collection(getDb(), 'travel_times'))
      .then((snapshot) => {
        if (cancelled) return;
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          travel_time_minutes: (doc.data().travel_time_minutes ?? 0) as number,
        }));
        setTravelTimeLookup(buildTravelTimeLookup(docs));
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { travelTimeLookup, loading, error };
}
