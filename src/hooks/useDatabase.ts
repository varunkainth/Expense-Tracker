import { useEffect, useState } from 'react';
import { getDatabase } from '../database/client';

export function useDatabase() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        await getDatabase();
        if (isMounted) {
          setIsReady(true);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  return { isReady, error };
}
