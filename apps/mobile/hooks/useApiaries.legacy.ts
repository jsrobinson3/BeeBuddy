import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { CreateApiaryInput, UpdateApiaryInput } from "../services/api";

export function useApiaries() {
  return useQuery({
    queryKey: ["apiaries"],
    queryFn: () => api.getApiaries(),
  });
}

export function useApiary(id: string) {
  return useQuery({
    queryKey: ["apiaries", id],
    queryFn: () => api.getApiary(id),
    enabled: !!id,
  });
}

export function useCreateApiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateApiaryInput) => api.createApiary(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiaries"] });
    },
  });
}

export function useUpdateApiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateApiaryInput }) =>
      api.updateApiary(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["apiaries"] });
      queryClient.invalidateQueries({ queryKey: ["apiaries", variables.id] });
    },
  });
}

export function useDeleteApiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteApiary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiaries"] });
    },
  });
}
