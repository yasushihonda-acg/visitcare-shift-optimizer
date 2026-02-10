'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { convertTimestamps } from '@/lib/firestore-converter';
import type { Order } from '@/types';

export function useOrders(weekStart: Date) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const weekStartTs = Timestamp.fromDate(weekStart);
    const q = query(
      collection(db, 'orders'),
      where('week_start_date', '==', weekStartTs)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach((doc) => {
          list.push(convertTimestamps<Order>({ id: doc.id, ...doc.data() }));
        });
        setOrders(list);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [weekStart]);

  return { orders, loading, error };
}
