import { useEffect, useState } from 'react';
import { emptyHousehold, watchHousehold } from '@/lib/household-firestore';

export function useHouseholdData(uid: string) {
  const [data, setData] = useState(emptyHousehold);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    return watchHousehold(uid, (next) => {
      setData(next);
      setError(false);
      setLoading(false);
    }, () => {
      setError(true);
      setLoading(false);
    });
  }, [uid, attempt]);

  return { data, loading, error, retry: () => setAttempt((value) => value + 1) };
}
