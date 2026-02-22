import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { CreateHarvestInput } from "../services/api";

export function useHarvests(hiveId?: string) {
  return useQuery({
    queryKey: ["harvests", { hiveId }],
    queryFn: () => api.getHarvests(hiveId),
  });
}

export function useHarvest(id: string) {
  return useQuery({
    queryKey: ["harvests", id],
    queryFn: () => api.getHarvest(id),
    enabled: !!id,
  });
}

export function useCreateHarvest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHarvestInput) => api.createHarvest(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["harvests"] });
      queryClient.invalidateQueries({ queryKey: ["hives", variables.hive_id] });
    },
  });
}
