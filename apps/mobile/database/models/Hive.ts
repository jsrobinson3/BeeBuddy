import { Model } from "@nozbe/watermelondb";
import { text, field, date, children, relation, readonly } from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";

export default class Hive extends Model {
  static table = "hives";

  static associations: Associations = {
    apiaries: { type: "belongs_to" as const, key: "apiary_id" },
    queens: { type: "has_many" as const, foreignKey: "hive_id" },
    inspections: { type: "has_many" as const, foreignKey: "hive_id" },
    treatments: { type: "has_many" as const, foreignKey: "hive_id" },
    harvests: { type: "has_many" as const, foreignKey: "hive_id" },
    events: { type: "has_many" as const, foreignKey: "hive_id" },
    tasks: { type: "has_many" as const, foreignKey: "hive_id" },
    task_cadences: { type: "has_many" as const, foreignKey: "hive_id" },
  };

  @text("apiary_id") apiaryId!: string;
  @text("name") name!: string;
  @text("hive_type") hiveType!: string;
  @text("status") status!: string;
  @text("source") source!: string | null;
  @text("installation_date") installationDate!: string | null;
  @text("color") color!: string | null;
  @field("position_order") order!: number | null;
  @text("notes") notes!: string | null;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  @relation("apiaries", "apiary_id") apiary!: any;
  @children("queens") queens!: any;
  @children("inspections") inspections!: any;
  @children("treatments") treatments!: any;
  @children("harvests") harvests!: any;
  @children("events") events!: any;
  @children("tasks") tasks!: any;
  @children("task_cadences") cadences!: any;
}
