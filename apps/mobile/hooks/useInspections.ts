import { Platform } from "react-native";

const impl =
  Platform.OS === "web"
    ? require("./useInspections.legacy")
    : require("./db/useInspections");

export const useInspections = impl.useInspections;
export const useInspection = impl.useInspection;
export const useCreateInspection = impl.useCreateInspection;
export const useUpdateInspection = impl.useUpdateInspection;
export const useDeleteInspection = impl.useDeleteInspection;
export const useInspectionTemplate = impl.useInspectionTemplate;
