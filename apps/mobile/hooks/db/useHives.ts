import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { database } from "../../database";
import Hive from "../../database/models/Hive";
import type { CreateHiveInput, UpdateHiveInput } from "../../services/api.types";
import { syncDatabase } from "../../database/sync";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";

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
        record._raw.apiary_id = data.apiary_id;
        record.name = data.name;
        record._raw.hive_type = data.hive_type ?? "langstroth";
        record._raw.status = "active";
        if (data.source) record._raw.source = data.source;
        if (data.installation_date) record._raw.installation_date = data.installation_date;
        if (data.notes) record._raw.notes = data.notes;
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
          if (data.name !== undefined) r.name = data.name;
          if (data.hive_type !== undefined) r._raw.hive_type = data.hive_type;
          if (data.status !== undefined) r._raw.status = data.status;
          if (data.source !== undefined) r._raw.source = data.source ?? null;
          if (data.installation_date !== undefined)
            r._raw.installation_date = data.installation_date ?? null;
          if (data.color !== undefined) r._raw.color = data.color ?? null;
          if (data.order !== undefined) r._raw.position_order = data.order ?? null;
          if (data.notes !== undefined) r._raw.notes = data.notes ?? null;
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
