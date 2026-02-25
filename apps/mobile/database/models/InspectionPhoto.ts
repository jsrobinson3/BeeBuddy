import { Model } from "@nozbe/watermelondb";
import { text, field, date, relation, readonly } from "@nozbe/watermelondb/decorators";
import type { Associations } from "@nozbe/watermelondb/Model";
import type { Relation } from "@nozbe/watermelondb/Model";
import type Inspection from "./Inspection";

export default class InspectionPhoto extends Model {
  static table = "inspection_photos";

  static associations: Associations = {
    inspections: { type: "belongs_to" as const, key: "inspection_id" },
  };

  @text("inspection_id") inspectionId!: string;
  @text("s3_key") s3Key!: string;
  @text("caption") caption!: string | null;
  @text("ai_analysis_json") aiAnalysisJson!: string | null;
  @text("url") url!: string | null;
  @date("uploaded_at") uploadedAt!: Date;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;

  @relation("inspections", "inspection_id") inspection!: Relation<Inspection>;

  get aiAnalysis(): Record<string, unknown> | null {
    if (!this.aiAnalysisJson) return null;
    try { return JSON.parse(this.aiAnalysisJson); } catch { return null; }
  }
}
