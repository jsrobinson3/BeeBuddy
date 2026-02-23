/**
 * API client for BeeBuddy backend
 */

export type {
  TokenResponse,
  LoginInput,
  RegisterInput,
  RefreshInput,
  User,
  UserUpdate,
  Apiary,
  CreateApiaryInput,
  UpdateApiaryInput,
  HiveType,
  HiveStatus,
  HiveSource,
  Hive,
  CreateHiveInput,
  UpdateHiveInput,
  QueenOrigin,
  QueenStatus,
  Queen,
  CreateQueenInput,
  UpdateQueenInput,
  InspectionObservations,
  WeatherSnapshot,
  InspectionPhoto,
  Inspection,
  CreateInspectionInput,
  UpdateInspectionInput,
  InspectionTemplate,
  Treatment,
  CreateTreatmentInput,
  UpdateTreatmentInput,
  Harvest,
  CreateHarvestInput,
  UpdateHarvestInput,
  EventType,
  HiveEvent,
  CreateEventInput,
  UpdateEventInput,
  TaskSource,
  TaskPriority,
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  CadenceCategory,
  CadenceSeason,
  CadenceTemplate,
  Cadence,
  UpdateCadenceInput,
} from "./api.types";

import type {
  TokenResponse,
  LoginInput,
  RegisterInput,
  RefreshInput,
  User,
  UserUpdate,
  Apiary,
  CreateApiaryInput,
  UpdateApiaryInput,
  Hive,
  CreateHiveInput,
  UpdateHiveInput,
  Queen,
  CreateQueenInput,
  UpdateQueenInput,
  InspectionPhoto,
  Inspection,
  CreateInspectionInput,
  UpdateInspectionInput,
  InspectionTemplate,
  Treatment,
  CreateTreatmentInput,
  UpdateTreatmentInput,
  Harvest,
  CreateHarvestInput,
  UpdateHarvestInput,
  HiveEvent,
  CreateEventInput,
  UpdateEventInput,
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  CadenceTemplate,
  Cadence,
  UpdateCadenceInput,
} from "./api.types";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

interface ApiConfig {
  baseUrl: string;
  token?: string;
}

/** Callback the auth store registers so the API client can trigger a refresh. */
type RefreshCallback = () => Promise<void>;

/** Callback the auth store registers so the API client can force a logout. */
type LogoutCallback = () => Promise<void>;

class ApiClient {
  private config: ApiConfig;
  private onRefresh: RefreshCallback | null = null;
  private onLogout: LogoutCallback | null = null;
  private refreshPromise: Promise<void> | null = null;

  constructor(config: ApiConfig) {
    this.config = config;
  }

  setToken(token: string | undefined) {
    this.config.token = token;
  }

  /** Called once by the auth store to wire up refresh/logout without circular imports. */
  setAuthCallbacks(onRefresh: RefreshCallback, onLogout: LogoutCallback) {
    this.onRefresh = onRefresh;
    this.onLogout = onLogout;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false,
  ): Promise<T> {
    const url = `${this.config.baseUrl}/api/v1${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (isWeb) {
      headers["X-Requested-With"] = "BeeBuddy";
    } else if (this.config.token) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      ...(isWeb && { credentials: "include" as RequestCredentials }),
    });

    // On 401, attempt a single token refresh then retry the original request.
    // Skip for auth endpoints (login/register/refresh) to avoid loops.
    if (
      response.status === 401 &&
      !isRetry &&
      this.onRefresh &&
      !endpoint.startsWith("/auth/")
    ) {
      try {
        // Coalesce concurrent refresh calls into one
        if (!this.refreshPromise) {
          this.refreshPromise = this.onRefresh().finally(() => {
            this.refreshPromise = null;
          });
        }
        await this.refreshPromise;
        return this.request<T>(endpoint, options, true);
      } catch {
        // Refresh failed — force logout
        await this.onLogout?.();
        throw new Error("Session expired");
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async login(data: LoginInput) {
    return this.request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async register(data: RegisterInput) {
    return this.request<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async refresh(data: RefreshInput) {
    return this.request<TokenResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async getMe() {
    return this.request<User>("/users/me");
  }

  async updateMe(data: UserUpdate) {
    return this.request<User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async updatePreferences(data: Record<string, unknown>) {
    return this.request<User>("/users/me/preferences", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // ── Apiaries ──────────────────────────────────────────────────────────────

  async getApiaries() {
    return this.request<Apiary[]>("/apiaries");
  }

  async getApiary(id: string) {
    return this.request<Apiary>(`/apiaries/${id}`);
  }

  async createApiary(data: CreateApiaryInput) {
    return this.request<Apiary>("/apiaries", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateApiary(id: string, data: UpdateApiaryInput) {
    return this.request<Apiary>(`/apiaries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteApiary(id: string) {
    return this.request<void>(`/apiaries/${id}`, { method: "DELETE" });
  }

  // ── Hives ─────────────────────────────────────────────────────────────────

  async getHives(apiaryId?: string) {
    const query = apiaryId ? `?apiary_id=${apiaryId}` : "";
    return this.request<Hive[]>(`/hives${query}`);
  }

  async getHive(id: string) {
    return this.request<Hive>(`/hives/${id}`);
  }

  async createHive(data: CreateHiveInput) {
    return this.request<Hive>("/hives", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateHive(id: string, data: UpdateHiveInput) {
    return this.request<Hive>(`/hives/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteHive(id: string) {
    return this.request<void>(`/hives/${id}`, { method: "DELETE" });
  }

  // ── Queens ────────────────────────────────────────────────────────────────

  async getQueens(hiveId?: string) {
    const query = hiveId ? `?hive_id=${hiveId}` : "";
    return this.request<Queen[]>(`/queens${query}`);
  }

  async getQueen(id: string) {
    return this.request<Queen>(`/queens/${id}`);
  }

  async createQueen(data: CreateQueenInput) {
    return this.request<Queen>("/queens", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateQueen(id: string, data: UpdateQueenInput) {
    return this.request<Queen>(`/queens/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteQueen(id: string) {
    return this.request<void>(`/queens/${id}`, { method: "DELETE" });
  }

  // ── Inspections ───────────────────────────────────────────────────────────

  async getInspections(hiveId?: string) {
    const query = hiveId ? `?hive_id=${hiveId}` : "";
    return this.request<Inspection[]>(`/inspections${query}`);
  }

  async getInspection(id: string) {
    return this.request<Inspection>(`/inspections/${id}`);
  }

  async createInspection(data: CreateInspectionInput) {
    return this.request<Inspection>("/inspections", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateInspection(id: string, data: UpdateInspectionInput) {
    return this.request<Inspection>(`/inspections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteInspection(id: string) {
    return this.request<void>(`/inspections/${id}`, { method: "DELETE" });
  }

  async getInspectionTemplate(
    level: "beginner" | "intermediate" | "advanced"
  ) {
    return this.request<InspectionTemplate>(
      `/inspections/templates/${level}`
    );
  }

  // ── Treatments ────────────────────────────────────────────────────────────

  async getTreatments(hiveId?: string) {
    const query = hiveId ? `?hive_id=${hiveId}` : "";
    return this.request<Treatment[]>(`/treatments${query}`);
  }

  async getTreatment(id: string) {
    return this.request<Treatment>(`/treatments/${id}`);
  }

  async createTreatment(data: CreateTreatmentInput) {
    return this.request<Treatment>("/treatments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTreatment(id: string, data: UpdateTreatmentInput) {
    return this.request<Treatment>(`/treatments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteTreatment(id: string) {
    return this.request<void>(`/treatments/${id}`, { method: "DELETE" });
  }

  // ── Harvests ──────────────────────────────────────────────────────────────

  async getHarvests(hiveId?: string) {
    const query = hiveId ? `?hive_id=${hiveId}` : "";
    return this.request<Harvest[]>(`/harvests${query}`);
  }

  async getHarvest(id: string) {
    return this.request<Harvest>(`/harvests/${id}`);
  }

  async createHarvest(data: CreateHarvestInput) {
    return this.request<Harvest>("/harvests", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateHarvest(id: string, data: UpdateHarvestInput) {
    return this.request<Harvest>(`/harvests/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteHarvest(id: string) {
    return this.request<void>(`/harvests/${id}`, { method: "DELETE" });
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async getEvents(hiveId?: string) {
    const query = hiveId ? `?hive_id=${hiveId}` : "";
    return this.request<HiveEvent[]>(`/events${query}`);
  }

  async getEvent(id: string) {
    return this.request<HiveEvent>(`/events/${id}`);
  }

  async createEvent(data: CreateEventInput) {
    return this.request<HiveEvent>("/events", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateEvent(id: string, data: UpdateEventInput) {
    return this.request<HiveEvent>(`/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteEvent(id: string) {
    return this.request<void>(`/events/${id}`, { method: "DELETE" });
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  async getTasks(filters?: { hive_id?: string; apiary_id?: string }) {
    const params = new URLSearchParams();
    if (filters?.hive_id) params.set("hive_id", filters.hive_id);
    if (filters?.apiary_id) params.set("apiary_id", filters.apiary_id);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<Task[]>(`/tasks${query}`);
  }

  async getTask(id: string) {
    return this.request<Task>(`/tasks/${id}`);
  }

  async createTask(data: CreateTaskInput) {
    return this.request<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: UpdateTaskInput) {
    return this.request<Task>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string) {
    return this.request<void>(`/tasks/${id}`, { method: "DELETE" });
  }

  // ── Cadences ───────────────────────────────────────────────────────────────

  async getCadenceCatalog() {
    return this.request<CadenceTemplate[]>("/cadences/catalog");
  }

  async getCadences() {
    return this.request<Cadence[]>("/cadences");
  }

  async initializeCadences() {
    return this.request<Cadence[]>("/cadences/initialize", { method: "POST" });
  }

  async updateCadence(id: string, data: UpdateCadenceInput) {
    return this.request<Cadence>(`/cadences/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async generateCadenceTasks() {
    return this.request<Task[]>("/cadences/generate", { method: "POST" });
  }

  // ── Photos ──────────────────────────────────────────────────────────────────

  async uploadPhoto(inspectionId: string, fileUri: string, caption?: string) {
    const url = `${this.config.baseUrl}/api/v1/inspections/${inspectionId}/photos`;
    const formData = new FormData();

    const filename = fileUri.split("/").pop() || "photo.jpg";
    const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
    const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    formData.append("file", { uri: fileUri, name: filename, type: mimeType } as any);
    if (caption) formData.append("caption", caption);

    const headers: Record<string, string> = {};
    if (isWeb) {
      headers["X-Requested-With"] = "BeeBuddy";
    } else if (this.config.token) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    }

    const response = await fetch(url, {
      method: "POST",
      body: formData,
      headers,
      ...(isWeb && { credentials: "include" as RequestCredentials }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `Upload failed: ${response.status}`);
    }

    return response.json() as Promise<InspectionPhoto>;
  }

  async getInspectionPhotos(inspectionId: string) {
    return this.request<InspectionPhoto[]>(`/inspections/${inspectionId}/photos`);
  }

  async deleteInspectionPhoto(inspectionId: string, photoId: string) {
    return this.request<void>(`/inspections/${inspectionId}/photos/${photoId}`, {
      method: "DELETE",
    });
  }
}

export const api = new ApiClient({ baseUrl: API_BASE_URL });

/**
 * Authenticated URL for loading a photo in <Image>.
 * Pass the access token as a query param since React Native's Image
 * component cannot send custom Authorization headers.
 */
export function getPhotoFileUrl(photoId: string, token?: string): string {
  const base = `${API_BASE_URL}/api/v1/photos/${photoId}/file`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}
