import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { CreateTreatmentInput, UpdateTreatmentInput } from "../services/api";

export function useTreatments(hiveId?: string) {
  return useQuery({
    queryKey: ["treatments", { hiveId }],
    queryFn: () => api.getTreatments(hiveId),
  });
}

export function useTreatment(id: string) {
  return useQuery({
    queryKey: ["treatments", id],
    queryFn: () => api.getTreatment(id),
    enabled: !!id,
  });
}

export function useCreateTreatment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTreatmentInput) => api.createTreatment(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["treatments"] });
      queryClient.invalidateQueries({ queryKey: ["hives", variables.hive_id] });
    },
  });
}

export function useUpdateTreatment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTreatmentInput }) =>
      api.updateTreatment(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["treatments"] });
      queryClient.invalidateQueries({ queryKey: ["treatments", variables.id] });
    },
  });
}

export function useDeleteTreatment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTreatment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treatments"] });
    },
  });
}
