import { Model } from "@nozbe/watermelondb";
import { text, field, date, relation, readonly } from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";

export default class Task extends Model {
  static table = "tasks";

  static associations: Associations = {
    hives: { type: "belongs_to" as const, key: "hive_id" },
    apiaries: { type: "belongs_to" as const, key: "apiary_id" },
  };

  @text("hive_id") hiveId!: string | null;
  @text("apiary_id") apiaryId!: string | null;
  @text("title") title!: string;
  @text("description") description!: string | null;
  @text("due_date") dueDate!: string | null;
  @field("recurring") recurring!: boolean;
  @text("recurrence_rule") recurrenceRule!: string | null;
  @text("source") source!: string;
  @field("completed_at") completedAt!: number | null;
  @text("priority") priority!: string;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  @relation("hives", "hive_id") hive!: any;
  @relation("apiaries", "apiary_id") apiary!: any;
}
