/**
 * Web version of useRefreshSync.
 *
 * On web the app uses TanStack Query instead of WatermelonDB, so
 * pull-to-refresh invalidates the query cache rather than running
 * a WatermelonDB sync.
 */

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useRefreshSync() {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return { refreshing, onRefresh };
}
