import { Platform } from "react-native";

const impl =
  Platform.OS === "web"
    ? require("./useQueens.legacy")
    : require("./db/useQueens");

export const useQueens = impl.useQueens;
export const useQueen = impl.useQueen;
export const useCreateQueen = impl.useCreateQueen;
export const useUpdateQueen = impl.useUpdateQueen;
