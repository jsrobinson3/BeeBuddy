import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { CreateShareInput, UpdateShareInput } from "../services/api";

export function useShares(params?: { apiaryId?: string; hiveId?: string }) {
  return useQuery({
    queryKey: ["shares", params],
    queryFn: () => api.getShares(params),
    enabled: !!(params?.apiaryId || params?.hiveId),
  });
}

export function useMyPendingShares() {
  return useQuery({
    queryKey: ["shares", "pending"],
    queryFn: () => api.getMyPendingShares(),
  });
}

export function useCreateShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateShareInput) => api.createShare(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares"] });
    },
  });
}

export function useAcceptShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => api.acceptShare(shareId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares"] });
      qc.invalidateQueries({ queryKey: ["apiaries"] });
      qc.invalidateQueries({ queryKey: ["hives"] });
    },
  });
}

export function useDeclineShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => api.declineShare(shareId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares"] });
    },
  });
}

export function useUpdateShareRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shareId, data }: { shareId: string; data: UpdateShareInput }) =>
      api.updateShareRole(shareId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares"] });
    },
  });
}

export function useRemoveShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => api.removeShare(shareId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares"] });
      qc.invalidateQueries({ queryKey: ["apiaries"] });
      qc.invalidateQueries({ queryKey: ["hives"] });
    },
  });
}
