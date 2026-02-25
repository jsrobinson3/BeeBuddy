import { Model } from "@nozbe/watermelondb";
import { text, field, date, relation, readonly } from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";
import type { Relation } from "@nozbe/watermelondb/Model";
import type Hive from "./Hive";

export default class Treatment extends Model {
  static table = "treatments";

  static associations: Associations = {
    hives: { type: "belongs_to" as const, key: "hive_id" },
  };

  @text("hive_id") hiveId!: string;
  @text("treatment_type") treatmentType!: string;
  @text("product_name") productName!: string | null;
  @text("method") method!: string | null;
  @field("started_at") startedAt!: number | null;
  @field("ended_at") endedAt!: number | null;
  @text("dosage") dosage!: string | null;
  @text("effectiveness_notes") effectivenessNotes!: string | null;
  @text("follow_up_date") followUpDate!: string | null;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  @relation("hives", "hive_id") hive!: Relation<Hive>;
}
