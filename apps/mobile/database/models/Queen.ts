import { Model } from "@nozbe/watermelondb";
import { text, field, date, relation, readonly } from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";

export default class Queen extends Model {
  static table = "queens";

  static associations: Associations = {
    hives: { type: "belongs_to" as const, key: "hive_id" },
  };

  @text("hive_id") hiveId!: string;
  @text("marking_color") markingColor!: string | null;
  @field("marking_year") markingYear!: number | null;
  @text("origin") origin!: string | null;
  @text("status") status!: string;
  @text("race") race!: string | null;
  @field("quality") quality!: number | null;
  @field("fertilized") fertilized!: boolean;
  @field("clipped") clipped!: boolean;
  @text("birth_date") birthDate!: string | null;
  @text("introduced_date") introducedDate!: string | null;
  @text("replaced_date") replacedDate!: string | null;
  @text("notes") notes!: string | null;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  @relation("hives", "hive_id") hive!: any;
}
