import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";

export function useInspectionPhotos(inspectionId: string) {
  return useQuery({
    queryKey: ["photos", inspectionId],
    queryFn: () => api.getInspectionPhotos(inspectionId),
    enabled: !!inspectionId,
    staleTime: 4 * 60 * 1000, // Refetch before 5-min presigned URL TTL expires
  });
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      inspectionId,
      fileUri,
      caption,
    }: {
      inspectionId: string;
      fileUri: string;
      caption?: string;
    }) => api.uploadPhoto(inspectionId, fileUri, caption),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["photos", variables.inspectionId] });
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      inspectionId,
      photoId,
    }: {
      inspectionId: string;
      photoId: string;
    }) => api.deleteInspectionPhoto(inspectionId, photoId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["photos", variables.inspectionId] });
      queryClient.invalidateQueries({ queryKey: ["inspections"] });
    },
  });
}
