import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { useQuery } from "@tanstack/react-query";
import { database } from "../../database";
import Inspection from "../../database/models/Inspection";
import { api } from "../../services/api";
import type { CreateInspectionInput, UpdateInspectionInput } from "../../services/api.types";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";
import type { RawRecord } from "@nozbe/watermelondb/RawRecord";

interface InspectionRaw extends RawRecord {
  hive_id: string;
  inspected_at: number;
  duration_minutes: number | null;
  experience_template: string;
  observations_json: string | null;
  weather_json: string | null;
  impression: number | null;
  attention: boolean | null;
  reminder: string | null;
  reminder_date: number | null;
  notes: string | null;
}

const inspectionsCollection = database.get<Inspection>("inspections");

export function useInspections(hiveId?: string) {
  const observable = useMemo(
    () =>
      hiveId
        ? inspectionsCollection.query(Q.where("hive_id", hiveId)).observe()
        : inspectionsCollection.query().observe(),
    [hiveId],
  );
  return useObservable(observable);
}

export function useInspection(id: string) {
  const observable = useMemo(
    () => (id ? inspectionsCollection.findAndObserve(id) : null),
    [id],
  );
  return useObservable(observable);
}

export function useCreateInspection() {
  const fn = useCallback(async (data: CreateInspectionInput) => {
    const created = await database.write(async () => {
      return inspectionsCollection.create((record) => {
        const raw = record._raw as InspectionRaw;
        raw.hive_id = data.hiveId;
        raw.inspected_at = data.inspectedAt
          ? new Date(data.inspectedAt).getTime()
          : Date.now();
        if (data.durationMinutes != null)
          raw.duration_minutes = data.durationMinutes;
        raw.experience_template = data.experienceTemplate ?? "beginner";
        if (data.observations)
          raw.observations_json = JSON.stringify(data.observations);
        if (data.weather) raw.weather_json = JSON.stringify(data.weather);
        if (data.impression != null) raw.impression = data.impression;
        if (data.attention != null) raw.attention = data.attention;
        if (data.reminder) raw.reminder = data.reminder;
        if (data.reminderDate)
          raw.reminder_date = new Date(data.reminderDate).getTime();
        if (data.notes) raw.notes = data.notes;
      });
    });
    syncAfterWrite();
    return { id: created.id };
  }, []);
  return useMutationWrapper(fn);
}

export function useUpdateInspection() {
  const fn = useCallback(
    async ({ id, data }: { id: string; data: UpdateInspectionInput }) => {
      const record = await inspectionsCollection.find(id);
      await database.write(async () => {
        await record.update((r) => {
          const raw = r._raw as InspectionRaw;
          if (data.inspectedAt !== undefined)
            raw.inspected_at = new Date(data.inspectedAt).getTime();
          if (data.durationMinutes !== undefined)
            raw.duration_minutes = data.durationMinutes ?? null;
          if (data.experienceTemplate !== undefined)
            raw.experience_template = data.experienceTemplate;
          if (data.observations !== undefined)
            raw.observations_json = data.observations
              ? JSON.stringify(data.observations)
              : null;
          if (data.weather !== undefined)
            raw.weather_json = data.weather
              ? JSON.stringify(data.weather)
              : null;
          if (data.impression !== undefined)
            raw.impression = data.impression ?? null;
          if (data.attention !== undefined)
            raw.attention = data.attention ?? null;
          if (data.reminder !== undefined) raw.reminder = data.reminder ?? null;
          if (data.reminderDate !== undefined)
            raw.reminder_date = data.reminderDate
              ? new Date(data.reminderDate).getTime()
              : null;
          if (data.notes !== undefined) raw.notes = data.notes ?? null;
        });
      });
      syncAfterWrite();
    },
    [],
  );
  return useMutationWrapper(fn);
}

export function useDeleteInspection() {
  const fn = useCallback(async (id: string) => {
    const record = await inspectionsCollection.find(id);
    await database.write(async () => {
      await record.markAsDeleted();
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}

/** Inspection templates are server-only, keep as React Query */
export function useInspectionTemplate(
  level: "beginner" | "intermediate" | "advanced",
) {
  return useQuery({
    queryKey: ["inspectionTemplate", level],
    queryFn: () => api.getInspectionTemplate(level),
    enabled: !!level,
  });
}
