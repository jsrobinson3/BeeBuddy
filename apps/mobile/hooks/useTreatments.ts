import { Platform } from "react-native";

const impl =
  Platform.OS === "web"
    ? require("./useTreatments.legacy")
    : require("./db/useTreatments");

export const useTreatments = impl.useTreatments;
export const useTreatment = impl.useTreatment;
export const useCreateTreatment = impl.useCreateTreatment;
export const useUpdateTreatment = impl.useUpdateTreatment;
export const useDeleteTreatment = impl.useDeleteTreatment;
