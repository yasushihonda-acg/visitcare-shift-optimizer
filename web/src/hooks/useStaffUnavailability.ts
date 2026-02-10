'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { convertTimestamps } from '@/lib/firestore-converter';
import type { StaffUnavailability } from '@/types';

export function useStaffUnavailability(weekStart: Date) {
  const [unavailability, setUnavailability] = useState<StaffUnavailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const weekStartTs = Timestamp.fromDate(weekStart);
    const q = query(
      collection(getDb(), 'staff_unavailability'),
      where('week_start_date', '==', weekStartTs)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: StaffUnavailability[] = [];
        snapshot.forEach((doc) => {
          list.push(convertTimestamps<StaffUnavailability>({ id: doc.id, ...doc.data() }));
        });
        setUnavailability(list);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [weekStart]);

  return { unavailability, loading, error };
}
