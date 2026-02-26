import { Platform } from "react-native";

const impl =
  Platform.OS === "web"
    ? require("./useTasks.legacy")
    : require("./db/useTasks");

export const useTasks = impl.useTasks;
export const useTask = impl.useTask;
export const useCreateTask = impl.useCreateTask;
export const useUpdateTask = impl.useUpdateTask;
export const useDeleteTask = impl.useDeleteTask;
