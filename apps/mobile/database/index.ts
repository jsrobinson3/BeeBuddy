import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { setGenerator } from "@nozbe/watermelondb/utils/common/randomId";

import schema from "./schema";
import migrations from "./migrations";
import { modelClasses } from "./models";

// Use RFC 4122 v4 UUIDs so local record ids round-trip through the server's
// UUID-typed columns. Without this, sync silently drops pushed records and
// routes like /inspections/{id}/photos 422 on the non-UUID path param.
setGenerator(() => {
  const g: { crypto?: { randomUUID?: () => string } } = globalThis as never;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  // Fallback: Math.random-based UUID v4 (not cryptographically strong, but
  // valid shape so the server accepts the record).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
});

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true,
  onSetUpError: (error) => {
    console.error("WatermelonDB setup error:", error);
  },
});

export const database = new Database({
  adapter,
  modelClasses,
});
