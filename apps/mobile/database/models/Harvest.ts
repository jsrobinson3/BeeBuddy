import { Model } from "@nozbe/watermelondb";
import { text, field, date, relation, readonly } from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";

export default class Harvest extends Model {
  static table = "harvests";

  static associations: Associations = {
    hives: { type: "belongs_to" as const, key: "hive_id" },
  };

  @text("hive_id") hiveId!: string;
  @field("harvested_at") harvestedAt!: number | null;
  @field("weight_kg") weightKg!: number | null;
  @field("moisture_percent") moisturePercent!: number | null;
  @text("honey_type") honeyType!: string | null;
  @text("flavor_notes") flavorNotes!: string | null;
  @text("color") color!: string | null;
  @field("frames_harvested") framesHarvested!: number | null;
  @text("notes") notes!: string | null;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  @relation("hives", "hive_id") hive!: any;
}
