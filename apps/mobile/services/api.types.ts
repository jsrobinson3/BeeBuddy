/**
 * Type definitions for BeeBuddy API
 */

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name?: string;
  email: string;
  password: string;
}

export interface RefreshInput {
  refresh_token: string;
}

// ─── User Types ───────────────────────────────────────────────────────────────

export interface UserPreferences {
  [key: string]: unknown;
  units?: "metric" | "imperial";
  hemisphere?: "north" | "south" | null;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  experience_level: "beginner" | "intermediate" | "advanced" | null;
  locale: string | null;
  timezone: string;
  preferences: UserPreferences | null;
  created_at: string;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  password?: string;
  experience_level?: string;
  locale?: string;
  timezone?: string;
}

// ─── Apiary Types ─────────────────────────────────────────────────────────────

export interface Apiary {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  country_code: string | null;
  hex_color: string | null;
  notes: string | null;
  created_at: string;
  hive_count: number;
}

export interface CreateApiaryInput {
  name: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country_code?: string;
  hex_color?: string;
  notes?: string;
}

export interface UpdateApiaryInput {
  name?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country_code?: string;
  hex_color?: string;
  notes?: string;
}

// ─── Hive Types ───────────────────────────────────────────────────────────────

export type HiveType = "langstroth" | "top_bar" | "warre" | "flow" | "other";
export type HiveStatus = "active" | "dead" | "combined" | "sold";
export type HiveSource = "package" | "nuc" | "swarm" | "split" | "purchased";

export interface Hive {
  id: string;
  apiary_id: string;
  name: string;
  hive_type: HiveType;
  status: HiveStatus;
  source: HiveSource | null;
  installation_date: string | null;
  color: string | null;
  order: number | null;
  notes: string | null;
  created_at: string;
}

export interface CreateHiveInput {
  apiary_id: string;
  name: string;
  hive_type?: HiveType;
  source?: HiveSource;
  installation_date?: string;
  notes?: string;
}

export interface UpdateHiveInput {
  name?: string;
  hive_type?: HiveType;
  status?: HiveStatus;
  source?: HiveSource;
  installation_date?: string;
  color?: string;
  order?: number;
  notes?: string;
}

// ─── Queen Types ──────────────────────────────────────────────────────────────

export type QueenOrigin = "purchased" | "raised" | "swarm";
export type QueenStatus = "present" | "missing" | "superseded" | "failed";

export interface Queen {
  id: string;
  hive_id: string;
  marking_color: string | null;
  marking_year: number | null;
  origin: QueenOrigin | null;
  status: QueenStatus;
  race: string | null;
  quality: number | null;
  fertilized: boolean;
  clipped: boolean;
  birth_date: string | null;
  introduced_date: string | null;
  replaced_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateQueenInput {
  hive_id: string;
  marking_color?: string;
  marking_year?: number;
  origin?: QueenOrigin;
  status?: QueenStatus;
  race?: string;
  quality?: number;
  fertilized?: boolean;
  clipped?: boolean;
  birth_date?: string;
  introduced_date?: string;
  notes?: string;
}

export interface UpdateQueenInput {
  marking_color?: string;
  marking_year?: number;
  origin?: QueenOrigin;
  status?: QueenStatus;
  race?: string;
  quality?: number;
  fertilized?: boolean;
  clipped?: boolean;
  birth_date?: string;
  introduced_date?: string;
  replaced_date?: string;
  notes?: string;
}

// ─── Inspection Types ─────────────────────────────────────────────────────────

export interface InspectionObservations {
  population_estimate?: string | null;
  frames_of_bees?: number | null;
  temperament?: string | null;
  queen_seen?: boolean | null;
  eggs_seen?: boolean | null;
  larvae_seen?: boolean | null;
  capped_brood?: boolean | null;
  brood_pattern_score?: number | null;
  honey_stores?: string | null;
  pollen_stores?: string | null;
  disease_signs?: string[] | null;
  pest_signs?: string[] | null;
  varroa_count?: number | null;
  num_supers?: number | null;
  frames_of_brood?: number | null;
}

export interface WeatherSnapshot {
  temp_c?: number | null;
  humidity_percent?: number | null;
  wind_speed_kmh?: number | null;
  conditions?: string | null;
}

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  s3_key: string;
  caption: string | null;
  ai_analysis: Record<string, unknown> | null;
  uploaded_at: string;
  url: string | null;
}

export interface Inspection {
  id: string;
  hive_id: string;
  inspected_at: string;
  duration_minutes: number | null;
  experience_template: "beginner" | "intermediate" | "advanced";
  observations: InspectionObservations | null;
  weather: WeatherSnapshot | null;
  impression: number | null;
  attention: boolean | null;
  reminder: string | null;
  reminder_date: string | null;
  notes: string | null;
  ai_summary: string | null;
  photos?: InspectionPhoto[];
  created_at: string;
}

export interface CreateInspectionInput {
  hive_id: string;
  inspected_at?: string;
  duration_minutes?: number;
  experience_template?: string;
  observations?: InspectionObservations;
  weather?: WeatherSnapshot;
  impression?: number;
  attention?: boolean;
  reminder?: string;
  reminder_date?: string;
  notes?: string;
}

export interface UpdateInspectionInput {
  inspected_at?: string;
  duration_minutes?: number;
  experience_template?: string;
  observations?: InspectionObservations;
  weather?: WeatherSnapshot;
  impression?: number;
  attention?: boolean;
  reminder?: string;
  reminder_date?: string;
  notes?: string;
}

export interface InspectionTemplate {
  level: string;
  fields: Array<{
    name: string;
    label: string;
    type: string;
    options?: string[];
    min?: number;
    max?: number;
  }>;
}

// ─── Treatment Types ──────────────────────────────────────────────────────────

export interface Treatment {
  id: string;
  hive_id: string;
  treatment_type: string;
  product_name: string | null;
  method: string | null;
  started_at: string | null;
  ended_at: string | null;
  dosage: string | null;
  effectiveness_notes: string | null;
  follow_up_date: string | null;
  created_at: string;
}

export interface CreateTreatmentInput {
  hive_id: string;
  treatment_type: string;
  product_name?: string;
  method?: string;
  started_at?: string;
  ended_at?: string;
  dosage?: string;
  effectiveness_notes?: string;
  follow_up_date?: string;
}

export interface UpdateTreatmentInput {
  treatment_type?: string;
  product_name?: string;
  method?: string;
  started_at?: string;
  ended_at?: string;
  dosage?: string;
  effectiveness_notes?: string;
  follow_up_date?: string;
}

// ─── Harvest Types ────────────────────────────────────────────────────────────

export interface Harvest {
  id: string;
  hive_id: string;
  harvested_at: string | null;
  weight_kg: number | null;
  moisture_percent: number | null;
  honey_type: string | null;
  flavor_notes: string | null;
  color: string | null;
  frames_harvested: number | null;
  notes: string | null;
  created_at: string;
}

export interface CreateHarvestInput {
  hive_id: string;
  harvested_at?: string;
  weight_kg?: number;
  moisture_percent?: number;
  honey_type?: string;
  flavor_notes?: string;
  color?: string;
  frames_harvested?: number;
  notes?: string;
}

export interface UpdateHarvestInput {
  harvested_at?: string;
  weight_kg?: number;
  moisture_percent?: number;
  honey_type?: string;
  flavor_notes?: string;
  color?: string;
  frames_harvested?: number;
  notes?: string;
}

// ─── HiveEvent Types ──────────────────────────────────────────────────────────

export type EventType =
  | "swarm"
  | "split"
  | "combine"
  | "requeen"
  | "feed"
  | "winter_prep";

export interface HiveEvent {
  id: string;
  hive_id: string;
  event_type: EventType;
  occurred_at: string | null;
  details: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
}

export interface CreateEventInput {
  hive_id: string;
  event_type: EventType;
  occurred_at?: string;
  details?: Record<string, unknown>;
  notes?: string;
}

export interface UpdateEventInput {
  event_type?: EventType;
  occurred_at?: string;
  details?: Record<string, unknown>;
  notes?: string;
}

// ─── Task Types ───────────────────────────────────────────────────────────────

export type TaskSource = "manual" | "ai_recommended" | "system";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  user_id: string;
  hive_id: string | null;
  apiary_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  recurring: boolean;
  recurrence_rule: string | null;
  source: TaskSource;
  completed_at: string | null;
  priority: TaskPriority;
  created_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  hive_id?: string;
  apiary_id?: string;
  due_date?: string;
  recurring?: boolean;
  recurrence_rule?: string;
  priority?: TaskPriority;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  due_date?: string;
  completed_at?: string | null;
  priority?: TaskPriority;
}

// ─── Cadence Types ─────────────────────────────────────────────────────────────

export type CadenceCategory = "recurring" | "seasonal";
export type CadenceSeason =
  | "spring"
  | "summer"
  | "fall"
  | "winter"
  | "year_round";

export type CadenceScope = "user" | "hive";

export interface CadenceTemplate {
  key: string;
  title: string;
  description: string;
  category: CadenceCategory;
  season: CadenceSeason;
  priority: TaskPriority;
  interval_days: number | null;
  season_month: number | null;
  season_day: number;
  scope: CadenceScope;
}

export interface Cadence {
  id: string;
  user_id: string;
  hive_id: string | null;
  cadence_key: string;
  is_active: boolean;
  last_generated_at: string | null;
  next_due_date: string | null;
  custom_interval_days: number | null;
  custom_season_month: number | null;
  custom_season_day: number | null;
  created_at: string;
}

export interface UpdateCadenceInput {
  is_active?: boolean;
  custom_interval_days?: number | null;
  custom_season_month?: number | null;
  custom_season_day?: number | null;
}

// ─── Account Deletion Types ──────────────────────────────────────────────────

export interface DeleteAccountInput {
  password: string;
  delete_data?: boolean;
}

export interface DeleteAccountResponse {
  detail: string;
}

