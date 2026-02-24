import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { UserUpdate, DeleteAccountInput } from "../services/api";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["user", "me"],
    queryFn: () => api.getMe(),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserUpdate) => api.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.updatePreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (data: DeleteAccountInput) => api.deleteMe(data),
  });
}
