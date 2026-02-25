/**
 * Generic hook that subscribes to a WatermelonDB Observable and returns
 * a React-Query-compatible shape: { data, isLoading, error }.
 */
import { useState, useEffect } from "react";
import type { Observable } from "rxjs";

export function useObservable<T>(observable: Observable<T> | null): {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!observable) {
      setData(undefined);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const subscription = observable.subscribe({
      next: (value) => {
        setData(value);
        setIsLoading(false);
        setError(null);
      },
      error: (err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [observable]);

  return { data, isLoading, error };
}
