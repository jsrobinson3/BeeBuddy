import { Platform } from "react-native";

const impl =
  Platform.OS === "web"
    ? require("./useHives.legacy")
    : require("./db/useHives");

export const useHives = impl.useHives;
export const useHive = impl.useHive;
export const useCreateHive = impl.useCreateHive;
export const useUpdateHive = impl.useUpdateHive;
export const useDeleteHive = impl.useDeleteHive;
