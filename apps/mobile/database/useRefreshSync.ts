import { useCallback, useState } from "react";
import { syncDatabase } from "./sync";

/**
 * Pull-to-refresh hook backed by WatermelonDB sync.
 * Returns { refreshing, onRefresh } — pass both to FlatList.
 */
export function useRefreshSync() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncDatabase();
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { refreshing, onRefresh };
}
