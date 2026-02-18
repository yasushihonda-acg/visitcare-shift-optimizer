'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { startOfMonth, addMonths } from 'date-fns';
import { getDb } from '@/lib/firebase';
import { convertTimestamps } from '@/lib/firestore-converter';
import type { Order } from '@/types';

/** 指定月に date が含まれるオーダーをリアルタイム取得 */
export function useMonthlyOrders(month: Date) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const monthStart = startOfMonth(month);
    const nextMonthStart = startOfMonth(addMonths(month, 1));

    const q = query(
      collection(getDb(), 'orders'),
      where('date', '>=', Timestamp.fromDate(monthStart)),
      where('date', '<', Timestamp.fromDate(nextMonthStart))
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
  }, [month]);

  return { orders, loading, error };
}
