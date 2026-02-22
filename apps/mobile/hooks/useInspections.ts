import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { CreateInspectionInput, UpdateInspectionInput } from "../services/api";

export function useInspections(hiveId?: string) {
  return useQuery({
    queryKey: ["inspections", { hiveId }],
    queryFn: () => api.getInspections(hiveId),
  });
}

export function useInspection(id: string) {
  return useQuery({
    queryKey: ["inspections", id],
    queryFn: () => api.getInspection(id),
    enabled: !!id,
  });
}

export function useCreateInspection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInspectionInput) => api.createInspection(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      queryClient.invalidateQueries({ queryKey: ["hives", variables.hive_id] });
    },
  });
}

export function useUpdateInspection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInspectionInput }) =>
      api.updateInspection(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
      queryClient.invalidateQueries({
        queryKey: ["inspections", variables.id],
      });
    },
  });
}

export function useInspectionTemplate(
  level: "beginner" | "intermediate" | "advanced"
) {
  return useQuery({
    queryKey: ["inspectionTemplate", level],
    queryFn: () => api.getInspectionTemplate(level),
    enabled: !!level,
  });
}
