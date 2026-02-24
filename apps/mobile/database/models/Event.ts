import { Model } from "@nozbe/watermelondb";
import { text, field, date, relation, readonly } from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";

export default class Event extends Model {
  static table = "events";

  static associations: Associations = {
    hives: { type: "belongs_to" as const, key: "hive_id" },
  };

  @text("hive_id") hiveId!: string;
  @text("event_type") eventType!: string;
  @date("occurred_at") occurredAt!: Date;
  @text("details_json") detailsJson!: string | null;
  @text("notes") notes!: string | null;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  @relation("hives", "hive_id") hive!: any;

  get details(): Record<string, unknown> | null {
    if (!this.detailsJson) return null;
    try { return JSON.parse(this.detailsJson); } catch { return null; }
  }
}
