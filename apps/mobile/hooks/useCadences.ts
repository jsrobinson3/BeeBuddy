import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { UpdateCadenceInput } from "../services/api";

export function useCadenceCatalog() {
  return useQuery({
    queryKey: ["cadences", "catalog"],
    queryFn: () => api.getCadenceCatalog(),
  });
}

export function useCadences(hiveId?: string) {
  return useQuery({
    queryKey: ["cadences", { hiveId }],
    queryFn: () => api.getCadences(hiveId),
  });
}

export function useInitializeCadences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.initializeCadences(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cadences"] });
    },
  });
}

export function useUpdateCadence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCadenceInput }) =>
      api.updateCadence(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cadences"] });
    },
  });
}

export function useGenerateCadenceTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.generateCadenceTasks(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["cadences"] });
    },
  });
}
