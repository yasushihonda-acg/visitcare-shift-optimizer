'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { convertTimestamps } from '@/lib/firestore-converter';
import type { ServiceTypeDoc } from '@/types';

export function useServiceTypes() {
  const [serviceTypes, setServiceTypes] = useState<Map<string, ServiceTypeDoc>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(getDb(), 'service_types'),
      (snapshot) => {
        const map = new Map<string, ServiceTypeDoc>();
        snapshot.forEach((doc) => {
          const data = convertTimestamps<ServiceTypeDoc>({ id: doc.id, ...doc.data() });
          map.set(doc.id, data);
        });
        setServiceTypes(map);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const sortedList = useMemo(
    () => Array.from(serviceTypes.values()).sort((a, b) => a.sort_order - b.sort_order),
    [serviceTypes]
  );

  return { serviceTypes, sortedList, loading, error };
}
