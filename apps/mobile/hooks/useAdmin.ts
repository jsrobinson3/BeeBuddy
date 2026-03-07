import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import type {
  AdminUserUpdate,
  OAuth2ClientCreate,
  OAuth2ClientUpdate,
} from "../services/api";

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.getAdminStats(),
  });
}

export function useAdminUsers(params?: {
  search?: string;
  includeDeleted?: boolean;
}) {
  return useQuery({
    queryKey: ["admin", "users", params],
    queryFn: () => api.getAdminUsers(params),
    select: (data) => ({ items: data.items, total: data.total }),
  });
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: ["admin", "users", id],
    queryFn: () => api.getAdminUser(id),
    enabled: !!id,
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminUserUpdate }) =>
      api.updateAdminUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export function useRestoreUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.restoreUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export function useOAuth2Clients() {
  return useQuery({
    queryKey: ["admin", "oauth-clients"],
    queryFn: () => api.getOAuth2Clients(),
  });
}

export function useCreateOAuth2Client() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OAuth2ClientCreate) => api.createOAuth2Client(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "oauth-clients"] });
    },
  });
}

export function useUpdateOAuth2Client() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: OAuth2ClientUpdate }) =>
      api.updateOAuth2Client(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "oauth-clients"] });
    },
  });
}
