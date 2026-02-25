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
    await database.write(async () => {
      await inspectionsCollection.create((record) => {
        record._raw.hive_id = data.hive_id;
        record._raw.inspected_at = data.inspected_at
          ? new Date(data.inspected_at).getTime()
          : Date.now();
        if (data.duration_minutes != null)
          record._raw.duration_minutes = data.duration_minutes;
        record._raw.experience_template = data.experience_template ?? "beginner";
        if (data.observations)
          record._raw.observations_json = JSON.stringify(data.observations);
        if (data.weather) record._raw.weather_json = JSON.stringify(data.weather);
        if (data.impression != null) record._raw.impression = data.impression;
        if (data.attention != null) record._raw.attention = data.attention;
        if (data.reminder) record._raw.reminder = data.reminder;
        if (data.reminder_date)
          record._raw.reminder_date = new Date(data.reminder_date).getTime();
        if (data.notes) record._raw.notes = data.notes;
      });
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}

export function useUpdateInspection() {
  const fn = useCallback(
    async ({ id, data }: { id: string; data: UpdateInspectionInput }) => {
      const record = await inspectionsCollection.find(id);
      await database.write(async () => {
        await record.update((r) => {
          if (data.inspected_at !== undefined)
            r._raw.inspected_at = new Date(data.inspected_at).getTime();
          if (data.duration_minutes !== undefined)
            r._raw.duration_minutes = data.duration_minutes ?? null;
          if (data.experience_template !== undefined)
            r._raw.experience_template = data.experience_template;
          if (data.observations !== undefined)
            r._raw.observations_json = data.observations
              ? JSON.stringify(data.observations)
              : null;
          if (data.weather !== undefined)
            r._raw.weather_json = data.weather
              ? JSON.stringify(data.weather)
              : null;
          if (data.impression !== undefined)
            r._raw.impression = data.impression ?? null;
          if (data.attention !== undefined)
            r._raw.attention = data.attention ?? null;
          if (data.reminder !== undefined) r._raw.reminder = data.reminder ?? null;
          if (data.reminder_date !== undefined)
            r._raw.reminder_date = data.reminder_date
              ? new Date(data.reminder_date).getTime()
              : null;
          if (data.notes !== undefined) r._raw.notes = data.notes ?? null;
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
