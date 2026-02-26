import { Platform } from "react-native";

const impl =
  Platform.OS === "web"
    ? require("./useHarvests.legacy")
    : require("./db/useHarvests");

export const useHarvests = impl.useHarvests;
export const useHarvest = impl.useHarvest;
export const useCreateHarvest = impl.useCreateHarvest;
export const useUpdateHarvest = impl.useUpdateHarvest;
export const useDeleteHarvest = impl.useDeleteHarvest;
