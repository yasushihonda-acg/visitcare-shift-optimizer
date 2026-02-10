'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { convertTimestamps } from '@/lib/firestore-converter';
import type { Helper } from '@/types';

export function useHelpers() {
  const [helpers, setHelpers] = useState<Map<string, Helper>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(getDb(), 'helpers'),
      (snapshot) => {
        const map = new Map<string, Helper>();
        snapshot.forEach((doc) => {
          const data = convertTimestamps<Helper>({ id: doc.id, ...doc.data() });
          map.set(doc.id, data);
        });
        setHelpers(map);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  return { helpers, loading, error };
}
