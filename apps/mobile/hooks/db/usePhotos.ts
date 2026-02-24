import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { database } from "../../database";
import InspectionPhoto from "../../database/models/InspectionPhoto";
import { api } from "../../services/api";
import { syncDatabase } from "../../database/sync";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";

const photosCollection = database.get<InspectionPhoto>("inspection_photos");

export function useInspectionPhotos(inspectionId: string) {
  const observable = useMemo(
    () =>
      inspectionId
        ? photosCollection
            .query(Q.where("inspection_id", inspectionId))
            .observe()
        : null,
    [inspectionId],
  );
  return useObservable(observable);
}

/** Upload still goes through the API (multipart upload to S3), then we sync to pull the metadata. */
export function useUploadPhoto() {
  const fn = useCallback(
    async ({
      inspectionId,
      fileUri,
      caption,
    }: {
      inspectionId: string;
      fileUri: string;
      caption?: string;
    }) => {
      await api.uploadPhoto(inspectionId, fileUri, caption);
      // Pull the new photo metadata from the server
      await syncDatabase();
    },
    [],
  );
  return useMutationWrapper(fn);
}

/** Delete goes through the API (server handles S3 cleanup), then sync. */
export function useDeletePhoto() {
  const fn = useCallback(
    async ({
      inspectionId,
      photoId,
    }: {
      inspectionId: string;
      photoId: string;
    }) => {
      await api.deleteInspectionPhoto(inspectionId, photoId);
      await syncDatabase();
    },
    [],
  );
  return useMutationWrapper(fn);
}
