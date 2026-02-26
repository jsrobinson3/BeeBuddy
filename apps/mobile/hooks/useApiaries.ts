import { Platform } from "react-native";

// On native, use WatermelonDB for offline-first. On web, use React Query (legacy).
const impl =
  Platform.OS === "web"
    ? require("./useApiaries.legacy")
    : require("./db/useApiaries");

export const useApiaries = impl.useApiaries;
export const useApiary = impl.useApiary;
export const useCreateApiary = impl.useCreateApiary;
export const useUpdateApiary = impl.useUpdateApiary;
export const useDeleteApiary = impl.useDeleteApiary;
