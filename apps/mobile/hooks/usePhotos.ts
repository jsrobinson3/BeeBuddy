import { Platform } from "react-native";

const impl =
  Platform.OS === "web"
    ? require("./usePhotos.legacy")
    : require("./db/usePhotos");

export const useInspectionPhotos = impl.useInspectionPhotos;
export const useUploadPhoto = impl.useUploadPhoto;
export const useDeletePhoto = impl.useDeletePhoto;
