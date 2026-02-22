import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { CreateHiveInput, UpdateHiveInput } from "../services/api";

export function useHives(apiaryId?: string) {
  return useQuery({
    queryKey: ["hives", { apiaryId }],
    queryFn: () => api.getHives(apiaryId),
  });
}

export function useHive(id: string) {
  return useQuery({
    queryKey: ["hives", id],
    queryFn: () => api.getHive(id),
    enabled: !!id,
  });
}

export function useCreateHive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHiveInput) => api.createHive(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hives"] });
      queryClient.invalidateQueries({ queryKey: ["apiaries", variables.apiary_id] });
      queryClient.invalidateQueries({ queryKey: ["apiaries"] });
    },
  });
}

export function useUpdateHive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateHiveInput }) =>
      api.updateHive(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hives"] });
      queryClient.invalidateQueries({ queryKey: ["hives", variables.id] });
    },
  });
}

export function useDeleteHive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteHive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hives"] });
      queryClient.invalidateQueries({ queryKey: ["apiaries"] });
    },
  });
}
