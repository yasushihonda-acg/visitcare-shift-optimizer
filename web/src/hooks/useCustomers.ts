'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { convertTimestamps } from '@/lib/firestore-converter';
import type { Customer } from '@/types';

export function useCustomers() {
  const [customers, setCustomers] = useState<Map<string, Customer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'customers'),
      (snapshot) => {
        const map = new Map<string, Customer>();
        snapshot.forEach((doc) => {
          const data = convertTimestamps<Customer>({ id: doc.id, ...doc.data() });
          map.set(doc.id, data);
        });
        setCustomers(map);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  return { customers, loading, error };
}
