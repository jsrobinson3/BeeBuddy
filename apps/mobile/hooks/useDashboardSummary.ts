import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "../services/api";

/**
 * Fetches the dashboard AI summary. The hosted API can sleep, so first request
 * of the day may take 20-40s. We give the query a generous retry policy and
 * expose a `isWarmingUp` flag that flips on after a few seconds of pending
 * load so the UI can swap "loading" for "warming up".
 */
export function useDashboardSummary(enabled = true) {
  const query = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => api.getDashboardSummary(),
    enabled,
    staleTime: 10 * 60 * 1000, // 10 min
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 16000),
  });

  const [isWarmingUp, setIsWarmingUp] = useState(false);
  useEffect(() => {
    if (!query.isPending) {
      setIsWarmingUp(false);
      return;
    }
    const timer = setTimeout(() => setIsWarmingUp(true), 5000);
    return () => clearTimeout(timer);
  }, [query.isPending]);

  return { ...query, isWarmingUp };
}
