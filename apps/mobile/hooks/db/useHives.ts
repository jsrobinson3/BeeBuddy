import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { database } from "../../database";
import Hive from "../../database/models/Hive";
import type { CreateHiveInput, UpdateHiveInput } from "../../services/api.types";
import { syncDatabase } from "../../database/sync";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";
import type { RawRecord } from "@nozbe/watermelondb/RawRecord";

interface HiveRaw extends RawRecord {
  apiary_id: string;
  hive_type: string;
  status: string;
  source: string | null;
  installation_date: string | null;
  install_kind: string | null;
  initial_frames: number | null;
  queen_introduced: boolean | null;
  color: string | null;
  position_order: number | null;
  notes: string | null;
}

const hivesCollection = database.get<Hive>("hives");

export function useHives(apiaryId?: string) {
  const observable = useMemo(
    () =>
      apiaryId
        ? hivesCollection.query(Q.where("apiary_id", apiaryId)).observe()
        : hivesCollection.query().observe(),
    [apiaryId],
  );
  return useObservable(observable);
}

export function useHive(id: string) {
  const observable = useMemo(
    () => (id ? hivesCollection.findAndObserve(id) : null),
    [id],
  );
  return useObservable(observable);
}

export function useCreateHive() {
  const fn = useCallback(async (data: CreateHiveInput) => {
    await database.write(async () => {
      await hivesCollection.create((record) => {
        const raw = record._raw as HiveRaw;
        raw.apiary_id = data.apiaryId;
        record.name = data.name;
        raw.hive_type = data.hiveType ?? "langstroth";
        raw.status = "active";
        if (data.source) raw.source = data.source;
        if (data.installationDate) raw.installation_date = data.installationDate;
        if (data.installKind) raw.install_kind = data.installKind;
        if (data.initialFrames != null) raw.initial_frames = data.initialFrames;
        if (data.queenIntroduced != null) raw.queen_introduced = data.queenIntroduced;
        if (data.notes) raw.notes = data.notes;
      });
    });
    syncAfterWrite();
    // Schedule a follow-up sync to pull back server-generated cadences/tasks.
    // The first sync pushes the hive; the server then creates cadences + tasks.
    // This second sync pulls those new records into the local DB.
    setTimeout(() => syncDatabase(), 3000);
  }, []);
  return useMutationWrapper(fn);
}

export function useUpdateHive() {
  const fn = useCallback(
    async ({ id, data }: { id: string; data: UpdateHiveInput }) => {
      const record = await hivesCollection.find(id);
      await database.write(async () => {
        await record.update((r) => {
          const raw = r._raw as HiveRaw;
          if (data.name !== undefined) r.name = data.name;
          if (data.hiveType !== undefined) raw.hive_type = data.hiveType;
          if (data.status !== undefined) raw.status = data.status;
          if (data.source !== undefined) raw.source = data.source ?? null;
          if (data.installationDate !== undefined)
            raw.installation_date = data.installationDate ?? null;
          if (data.installKind !== undefined)
            raw.install_kind = data.installKind ?? null;
          if (data.initialFrames !== undefined)
            raw.initial_frames = data.initialFrames ?? null;
          if (data.queenIntroduced !== undefined)
            raw.queen_introduced = data.queenIntroduced ?? null;
          if (data.color !== undefined) raw.color = data.color ?? null;
          if (data.order !== undefined) raw.position_order = data.order ?? null;
          if (data.notes !== undefined) raw.notes = data.notes ?? null;
        });
      });
      syncAfterWrite();
    },
    [],
  );
  return useMutationWrapper(fn);
}

export function useDeleteHive() {
  const fn = useCallback(async (id: string) => {
    const record = await hivesCollection.find(id);
    await database.write(async () => {
      await record.markAsDeleted();
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}
