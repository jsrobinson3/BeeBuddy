import { Model } from "@nozbe/watermelondb";
import { text, field, date, children, relation, readonly } from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";
import type { InspectionObservations, WeatherSnapshot } from "../../services/api.types";

export default class Inspection extends Model {
  static table = "inspections";

  static associations: Associations = {
    hives: { type: "belongs_to" as const, key: "hive_id" },
    inspection_photos: { type: "has_many" as const, foreignKey: "inspection_id" },
  };

  @text("hive_id") hiveId!: string;
  @date("inspected_at") inspectedAt!: Date;
  @field("duration_minutes") durationMinutes!: number | null;
  @text("experience_template") experienceTemplate!: string;
  @text("observations_json") observationsJson!: string | null;
  @text("weather_json") weatherJson!: string | null;
  @field("impression") impression!: number | null;
  @field("attention") attention!: boolean | null;
  @text("reminder") reminder!: string | null;
  @field("reminder_date") reminderDate!: number | null;
  @text("ai_summary") aiSummary!: string | null;
  @text("notes") notes!: string | null;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  @relation("hives", "hive_id") hive!: any;
  @children("inspection_photos") photos!: any;

  get observations(): InspectionObservations | null {
    if (!this.observationsJson) return null;
    try { return JSON.parse(this.observationsJson); } catch { return null; }
  }

  get weather(): WeatherSnapshot | null {
    if (!this.weatherJson) return null;
    try { return JSON.parse(this.weatherJson); } catch { return null; }
  }
}
