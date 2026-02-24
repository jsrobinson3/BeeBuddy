import { Model } from "@nozbe/watermelondb";
import { text, field, date, relation, readonly } from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";

export default class TaskCadence extends Model {
  static table = "task_cadences";

  static associations: Associations = {
    hives: { type: "belongs_to" as const, key: "hive_id" },
  };

  @text("hive_id") hiveId!: string | null;
  @text("cadence_key") cadenceKey!: string;
  @field("is_active") isActive!: boolean;
  @field("last_generated_at") lastGeneratedAt!: number | null;
  @text("next_due_date") nextDueDate!: string | null;
  @field("custom_interval_days") customIntervalDays!: number | null;
  @field("custom_season_month") customSeasonMonth!: number | null;
  @field("custom_season_day") customSeasonDay!: number | null;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  @relation("hives", "hive_id") hive!: any;
}
