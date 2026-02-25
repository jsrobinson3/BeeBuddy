import { Model, type Query } from "@nozbe/watermelondb";
import { text, field, date, children, relation, readonly } from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";
import type { Relation } from "@nozbe/watermelondb/Model";
import type Apiary from "./Apiary";
import type Queen from "./Queen";
import type Inspection from "./Inspection";
import type Treatment from "./Treatment";
import type Harvest from "./Harvest";
import type Event from "./Event";
import type Task from "./Task";
import type TaskCadence from "./TaskCadence";

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

  @relation("apiaries", "apiary_id") apiary!: Relation<Apiary>;
  @children("queens") queens!: Query<Queen>;
  @children("inspections") inspections!: Query<Inspection>;
  @children("treatments") treatments!: Query<Treatment>;
  @children("harvests") harvests!: Query<Harvest>;
  @children("events") events!: Query<Event>;
  @children("tasks") tasks!: Query<Task>;
  @children("task_cadences") cadences!: Query<TaskCadence>;
}
