import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type { User, UserUpdate, DeleteAccountInput } from "../services/api";

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

function mergePreferences(old: User, data: Record<string, unknown>): User {
  return { ...old, preferences: { ...old.preferences, ...data } as User["preferences"] };
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.updatePreferences(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["user", "me"] });
      const previous = queryClient.getQueryData<User>(["user", "me"]);
      queryClient.setQueryData<User>(["user", "me"], (old) =>
        old ? mergePreferences(old, data) : old,
      );
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["user", "me"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (data: DeleteAccountInput) => api.deleteMe(data),
  });
}
