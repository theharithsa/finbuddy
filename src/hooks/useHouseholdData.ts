import { useEffect, useState } from 'react';
import { emptyHousehold, watchHousehold } from '@/lib/household-firestore';

export function useHouseholdData(uid: string) {
  const [data, setData] = useState(emptyHousehold);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    return watchHousehold(uid, (next) => {
      setData(next);
      setError(false);
      setLoading(false);
    }, () => {
      setError(true);
      setLoading(false);
    });
  }, [uid, attempt]);

  function retry() {
    setLoading(true);
    setError(false);
    setAttempt((value) => value + 1);
  }

  return { data, loading, error, retry };
}
