import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { CreateHarvestInput, UpdateHarvestInput } from "../services/api";

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

export function useUpdateHarvest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateHarvestInput }) =>
      api.updateHarvest(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["harvests"] });
      queryClient.invalidateQueries({ queryKey: ["harvests", variables.id] });
    },
  });
}

export function useDeleteHarvest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteHarvest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["harvests"] });
    },
  });
}
