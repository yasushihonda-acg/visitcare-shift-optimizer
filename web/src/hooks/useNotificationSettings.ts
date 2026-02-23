'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';

export function useNotificationSettings() {
  const [senderEmail, setSenderEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(getDb(), 'settings', 'notification'),
      (snapshot) => {
        if (snapshot.exists()) {
          setSenderEmail(snapshot.data()?.sender_email ?? null);
        } else {
          setSenderEmail(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  return { senderEmail, loading, error };
}
