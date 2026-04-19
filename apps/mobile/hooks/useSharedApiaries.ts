import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import type { Apiary } from "../services/api.types";

/**
 * Fetch apiaries from the REST API and filter to only shared ones
 * (where myRole is set and not "owner"). Used alongside the WatermelonDB
 * useApiaries hook on native to show the "Shared with Me" section.
 */
export function useSharedApiaries() {
  return useQuery({
    queryKey: ["apiaries", "shared"],
    queryFn: async () => {
      const all = await api.getApiaries();
      return all.filter((a: Apiary) => a.myRole && a.myRole !== "owner");
    },
  });
}
