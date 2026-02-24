import { Model } from "@nozbe/watermelondb";
import { text, field, date, children, readonly } from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";

export default class Apiary extends Model {
  static table = "apiaries";

  static associations: Associations = {
    hives: { type: "has_many" as const, foreignKey: "apiary_id" },
    tasks: { type: "has_many" as const, foreignKey: "apiary_id" },
  };

  @text("name") name!: string;
  @field("latitude") latitude!: number | null;
  @field("longitude") longitude!: number | null;
  @text("city") city!: string | null;
  @text("country_code") countryCode!: string | null;
  @text("hex_color") hexColor!: string | null;
  @text("notes") notes!: string | null;
  @field("archived_at") archivedAt!: number | null;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  @children("hives") hives!: any;
  @children("tasks") tasks!: any;
}
