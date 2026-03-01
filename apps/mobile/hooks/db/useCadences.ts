import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { database } from "../../database";
import TaskCadence from "../../database/models/TaskCadence";
import { api } from "../../services/api";
import type { UpdateCadenceInput } from "../../services/api.types";
import { syncDatabase } from "../../database/sync";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";
import type { RawRecord } from "@nozbe/watermelondb/RawRecord";

interface TaskCadenceRaw extends RawRecord {
  is_active: boolean;
  custom_interval_days: number | null;
  custom_season_month: number | null;
  custom_season_day: number | null;
}

const cadencesCollection = database.get<TaskCadence>("task_cadences");

/** Cadence catalog is server-only — stays as React Query */
export function useCadenceCatalog() {
  return useQuery({
    queryKey: ["cadences", "catalog"],
    queryFn: () => api.getCadenceCatalog(),
  });
}

export function useCadences(hiveId?: string) {
  const observable = useMemo(
    () =>
      hiveId
        ? cadencesCollection.query(Q.where("hive_id", hiveId)).observe()
        : cadencesCollection.query().observe(),
    [hiveId],
  );
  return useObservable(observable);
}

/** Initialize cadences goes through the API then syncs */
export function useInitializeCadences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await api.initializeCadences();
      await syncDatabase();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cadences"] });
    },
  });
}

export function useUpdateCadence() {
  const fn = useCallback(
    async ({ id, data }: { id: string; data: UpdateCadenceInput }) => {
      const record = await cadencesCollection.find(id);
      await database.write(async () => {
        await record.update((r) => {
          const raw = r._raw as TaskCadenceRaw;
          if (data.isActive !== undefined) raw.is_active = data.isActive;
          if (data.customIntervalDays !== undefined)
            raw.custom_interval_days = data.customIntervalDays ?? null;
          if (data.customSeasonMonth !== undefined)
            raw.custom_season_month = data.customSeasonMonth ?? null;
          if (data.customSeasonDay !== undefined)
            raw.custom_season_day = data.customSeasonDay ?? null;
        });
      });
      syncAfterWrite();
    },
    [],
  );
  return useMutationWrapper(fn);
}

/** Generate cadence tasks goes through the API then syncs */
export function useGenerateCadenceTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await api.generateCadenceTasks();
      await syncDatabase();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["cadences"] });
    },
  });
}
