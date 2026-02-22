import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { CreateQueenInput, UpdateQueenInput } from "../services/api";

export function useQueens(hiveId?: string) {
  return useQuery({
    queryKey: ["queens", { hiveId }],
    queryFn: () => api.getQueens(hiveId),
  });
}

export function useQueen(id: string) {
  return useQuery({
    queryKey: ["queens", id],
    queryFn: () => api.getQueen(id),
    enabled: !!id,
  });
}

export function useCreateQueen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQueenInput) => api.createQueen(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["queens"] });
      queryClient.invalidateQueries({ queryKey: ["hives", variables.hive_id] });
    },
  });
}

export function useUpdateQueen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQueenInput }) =>
      api.updateQueen(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["queens"] });
      queryClient.invalidateQueries({ queryKey: ["queens", variables.id] });
    },
  });
}
