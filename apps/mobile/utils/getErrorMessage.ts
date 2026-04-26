import * as Sentry from "@sentry/react-native";

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // Report to Sentry so caught errors surface in Issues (otherwise only
    // unhandled rejections/native crashes are auto-captured).
    try {
      Sentry.captureException(err);
    } catch {
      // Sentry may not be initialized (e.g. no EXPO_PUBLIC_SENTRY_DSN).
    }
    return err.message;
  }
  return String(err);
}
