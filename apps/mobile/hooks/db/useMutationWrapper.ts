/**
 * Wraps an async function to match React Query's mutation shape:
 * { mutateAsync, mutate, isPending, error, reset }
 */
import { useState, useCallback } from "react";

export function useMutationWrapper<TInput, TResult = void>(
  fn: (input: TInput) => Promise<TResult>,
) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = useCallback(
    async (input: TInput): Promise<TResult> => {
      setIsPending(true);
      setError(null);
      try {
        const result = await fn(input);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [fn],
  );

  const mutate = useCallback(
    (input: TInput) => {
      mutateAsync(input).catch(() => {});
    },
    [mutateAsync],
  );

  const reset = useCallback(() => setError(null), []);

  return { mutateAsync, mutate, isPending, error, reset };
}
