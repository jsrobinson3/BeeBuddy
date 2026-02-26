import { Platform } from "react-native";

const impl =
  Platform.OS === "web"
    ? require("./useCadences.legacy")
    : require("./db/useCadences");

export const useCadenceCatalog = impl.useCadenceCatalog;
export const useCadences = impl.useCadences;
export const useInitializeCadences = impl.useInitializeCadences;
export const useUpdateCadence = impl.useUpdateCadence;
export const useGenerateCadenceTasks = impl.useGenerateCadenceTasks;
