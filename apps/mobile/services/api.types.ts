/**
 * Type definitions for BeeBuddy API
 */

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
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
  refreshToken: string;
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
  experienceLevel: "beginner" | "intermediate" | "advanced" | null;
  locale: string | null;
  timezone: string;
  preferences: UserPreferences | null;
  createdAt: string;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  experienceLevel?: string;
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
  countryCode: string | null;
  hexColor: string | null;
  notes: string | null;
  createdAt: string;
  hiveCount: number;
}

export interface CreateApiaryInput {
  name: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  countryCode?: string;
  hexColor?: string;
  notes?: string;
}

export interface UpdateApiaryInput {
  name?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  countryCode?: string;
  hexColor?: string;
  notes?: string;
}

// ─── Hive Types ───────────────────────────────────────────────────────────────

export type HiveType = "langstroth" | "top_bar" | "warre" | "flow" | "other";
export type HiveStatus = "active" | "dead" | "combined" | "sold";
export type HiveSource = "package" | "nuc" | "swarm" | "split" | "purchased";

export interface Hive {
  id: string;
  apiaryId: string;
  name: string;
  hiveType: HiveType;
  status: HiveStatus;
  source: HiveSource | null;
  installationDate: string | null;
  color: string | null;
  order: number | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateHiveInput {
  apiaryId: string;
  name: string;
  hiveType?: HiveType;
  source?: HiveSource;
  installationDate?: string;
  notes?: string;
}

export interface UpdateHiveInput {
  name?: string;
  hiveType?: HiveType;
  status?: HiveStatus;
  source?: HiveSource;
  installationDate?: string;
  color?: string;
  order?: number;
  notes?: string;
}

// ─── Queen Types ──────────────────────────────────────────────────────────────

export type QueenOrigin = "purchased" | "raised" | "swarm";
export type QueenStatus = "present" | "missing" | "superseded" | "failed";

export interface Queen {
  id: string;
  hiveId: string;
  markingColor: string | null;
  markingYear: number | null;
  origin: QueenOrigin | null;
  status: QueenStatus;
  race: string | null;
  quality: number | null;
  fertilized: boolean;
  clipped: boolean;
  birthDate: string | null;
  introducedDate: string | null;
  replacedDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateQueenInput {
  hiveId: string;
  markingColor?: string;
  markingYear?: number;
  origin?: QueenOrigin;
  status?: QueenStatus;
  race?: string;
  quality?: number;
  fertilized?: boolean;
  clipped?: boolean;
  birthDate?: string;
  introducedDate?: string;
  notes?: string;
}

export interface UpdateQueenInput {
  markingColor?: string;
  markingYear?: number;
  origin?: QueenOrigin;
  status?: QueenStatus;
  race?: string;
  quality?: number;
  fertilized?: boolean;
  clipped?: boolean;
  birthDate?: string;
  introducedDate?: string;
  replacedDate?: string;
  notes?: string;
}

// ─── Inspection Types ─────────────────────────────────────────────────────────

export interface InspectionObservations {
  populationEstimate?: string | null;
  framesOfBees?: number | null;
  temperament?: string | null;
  queenSeen?: boolean | null;
  eggsSeen?: boolean | null;
  larvaeSeen?: boolean | null;
  cappedBrood?: boolean | null;
  broodPatternScore?: number | null;
  honeyStores?: string | null;
  pollenStores?: string | null;
  diseaseSigns?: string[] | null;
  pestSigns?: string[] | null;
  varroaCount?: number | null;
  numSupers?: number | null;
  framesOfBrood?: number | null;
}

export interface WeatherSnapshot {
  tempC?: number | null;
  humidityPercent?: number | null;
  windSpeedKmh?: number | null;
  conditions?: string | null;
}

export interface InspectionPhoto {
  id: string;
  inspectionId: string;
  s3Key: string;
  caption: string | null;
  aiAnalysis: Record<string, unknown> | null;
  uploadedAt: string;
  url: string | null;
}

export interface Inspection {
  id: string;
  hiveId: string;
  inspectedAt: string;
  durationMinutes: number | null;
  experienceTemplate: "beginner" | "intermediate" | "advanced";
  observations: InspectionObservations | null;
  weather: WeatherSnapshot | null;
  impression: number | null;
  attention: boolean | null;
  reminder: string | null;
  reminderDate: string | null;
  notes: string | null;
  aiSummary: string | null;
  photos?: InspectionPhoto[];
  createdAt: string;
}

export interface CreateInspectionInput {
  hiveId: string;
  inspectedAt?: string;
  durationMinutes?: number;
  experienceTemplate?: string;
  observations?: InspectionObservations;
  weather?: WeatherSnapshot;
  impression?: number;
  attention?: boolean;
  reminder?: string;
  reminderDate?: string;
  notes?: string;
}

export interface UpdateInspectionInput {
  inspectedAt?: string;
  durationMinutes?: number;
  experienceTemplate?: string;
  observations?: InspectionObservations;
  weather?: WeatherSnapshot;
  impression?: number;
  attention?: boolean;
  reminder?: string;
  reminderDate?: string;
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
  hiveId: string;
  treatmentType: string;
  productName: string | null;
  method: string | null;
  startedAt: string | null;
  endedAt: string | null;
  dosage: string | null;
  effectivenessNotes: string | null;
  followUpDate: string | null;
  createdAt: string;
}

export interface CreateTreatmentInput {
  hiveId: string;
  treatmentType: string;
  productName?: string;
  method?: string;
  startedAt?: string;
  endedAt?: string;
  dosage?: string;
  effectivenessNotes?: string;
  followUpDate?: string;
}

export interface UpdateTreatmentInput {
  treatmentType?: string;
  productName?: string;
  method?: string;
  startedAt?: string;
  endedAt?: string;
  dosage?: string;
  effectivenessNotes?: string;
  followUpDate?: string;
}

// ─── Harvest Types ────────────────────────────────────────────────────────────

export interface Harvest {
  id: string;
  hiveId: string;
  harvestedAt: string | null;
  weightKg: number | null;
  moisturePercent: number | null;
  honeyType: string | null;
  flavorNotes: string | null;
  color: string | null;
  framesHarvested: number | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateHarvestInput {
  hiveId: string;
  harvestedAt?: string;
  weightKg?: number;
  moisturePercent?: number;
  honeyType?: string;
  flavorNotes?: string;
  color?: string;
  framesHarvested?: number;
  notes?: string;
}

export interface UpdateHarvestInput {
  harvestedAt?: string;
  weightKg?: number;
  moisturePercent?: number;
  honeyType?: string;
  flavorNotes?: string;
  color?: string;
  framesHarvested?: number;
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
  hiveId: string;
  eventType: EventType;
  occurredAt: string | null;
  details: Record<string, unknown> | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateEventInput {
  hiveId: string;
  eventType: EventType;
  occurredAt?: string;
  details?: Record<string, unknown>;
  notes?: string;
}

export interface UpdateEventInput {
  eventType?: EventType;
  occurredAt?: string;
  details?: Record<string, unknown>;
  notes?: string;
}

// ─── Task Types ───────────────────────────────────────────────────────────────

export type TaskSource = "manual" | "ai_recommended" | "system";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  userId: string;
  hiveId: string | null;
  apiaryId: string | null;
  title: string;
  description: string | null;
  dueDate: string | null;
  recurring: boolean;
  recurrenceRule: string | null;
  source: TaskSource;
  completedAt: string | null;
  priority: TaskPriority;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  hiveId?: string;
  apiaryId?: string;
  dueDate?: string;
  recurring?: boolean;
  recurrenceRule?: string;
  priority?: TaskPriority;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  dueDate?: string;
  completedAt?: string | null;
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
  intervalDays: number | null;
  seasonMonth: number | null;
  seasonDay: number;
  scope: CadenceScope;
}

export interface Cadence {
  id: string;
  userId: string;
  hiveId: string | null;
  cadenceKey: string;
  isActive: boolean;
  lastGeneratedAt: string | null;
  nextDueDate: string | null;
  customIntervalDays: number | null;
  customSeasonMonth: number | null;
  customSeasonDay: number | null;
  createdAt: string;
}

export interface UpdateCadenceInput {
  isActive?: boolean;
  customIntervalDays?: number | null;
  customSeasonMonth?: number | null;
  customSeasonDay?: number | null;
}

// ─── Account Deletion Types ──────────────────────────────────────────────────

// ─── Sync Types ──────────────────────────────────────────────────────────────

export interface SyncRecord {
  id: string;
  [key: string]: unknown;
}

export interface SyncTableChanges {
  created: SyncRecord[];
  updated: SyncRecord[];
  deleted: string[];
}

export type SyncChangesMap = Record<string, SyncTableChanges>;

// ─── Account Deletion Types ──────────────────────────────────────────────────

export interface DeleteAccountInput {
  password: string;
  deleteData?: boolean;
}

export interface DeleteAccountResponse {
  detail: string;
}

// ─── AI Chat Types ──────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  hiveId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail extends Conversation {
  messages: ChatMessage[];
}

export interface ChatRequest {
  messages: ChatMessage[];
  hiveId?: string;
  conversationId?: string;
}

// ─── Pending Action Types ────────────────────────────────────────────────────

export interface PendingAction {
  id: string;
  actionType: string;
  resourceType: string;
  summary: string;
  payload: Record<string, unknown>;
  expiresAt: string;
  status?: "pending" | "confirmed" | "rejected" | "expired";
  resultId?: string;
}

export interface PendingActionResponse {
  id: string;
  actionType: string;
  resourceType: string;
  summary: string;
  payload: Record<string, unknown>;
  status: string;
  expiresAt: string;
  executedAt?: string;
  resultId?: string;
}

