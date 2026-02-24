import { Platform } from "react-native";

const impl =
  Platform.OS === "web"
    ? require("./useEvents.legacy")
    : require("./db/useEvents");

export const useEvents = impl.useEvents;
export const useEvent = impl.useEvent;
export const useCreateEvent = impl.useCreateEvent;
export const useUpdateEvent = impl.useUpdateEvent;
export const useDeleteEvent = impl.useDeleteEvent;
