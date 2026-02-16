import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'visitcare-welcome-shown';

export function useWelcomeDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const shown = localStorage.getItem(STORAGE_KEY);
    if (!shown) {
      setOpen(true);
    }
  }, []);

  const closeWelcome = useCallback(() => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  const reopenWelcome = useCallback(() => {
    setOpen(true);
  }, []);

  return { welcomeOpen: open, closeWelcome, reopenWelcome };
}
