import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { database } from "../../database";
import Queen from "../../database/models/Queen";
import type { CreateQueenInput, UpdateQueenInput } from "../../services/api.types";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";

const queensCollection = database.get<Queen>("queens");

export function useQueens(hiveId?: string) {
  const observable = useMemo(
    () =>
      hiveId
        ? queensCollection.query(Q.where("hive_id", hiveId)).observe()
        : queensCollection.query().observe(),
    [hiveId],
  );
  return useObservable(observable);
}

export function useQueen(id: string) {
  const observable = useMemo(
    () => (id ? queensCollection.findAndObserve(id) : null),
    [id],
  );
  return useObservable(observable);
}

export function useCreateQueen() {
  const fn = useCallback(async (data: CreateQueenInput) => {
    await database.write(async () => {
      await queensCollection.create((record) => {
        record._raw.hive_id = data.hive_id;
        if (data.marking_color) record._raw.marking_color = data.marking_color;
        if (data.marking_year != null) record._raw.marking_year = data.marking_year;
        if (data.origin) record._raw.origin = data.origin;
        record._raw.status = data.status ?? "present";
        if (data.race) record._raw.race = data.race;
        if (data.quality != null) record._raw.quality = data.quality;
        record._raw.fertilized = data.fertilized ?? false;
        record._raw.clipped = data.clipped ?? false;
        if (data.birth_date) record._raw.birth_date = data.birth_date;
        if (data.introduced_date) record._raw.introduced_date = data.introduced_date;
        if (data.notes) record._raw.notes = data.notes;
      });
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}

export function useDeleteQueen() {
  const fn = useCallback(async (id: string) => {
    const record = await queensCollection.find(id);
    await database.write(async () => {
      await record.markAsDeleted();
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}

export function useUpdateQueen() {
  const fn = useCallback(
    async ({ id, data }: { id: string; data: UpdateQueenInput }) => {
      const record = await queensCollection.find(id);
      await database.write(async () => {
        await record.update((r) => {
          if (data.marking_color !== undefined) r._raw.marking_color = data.marking_color ?? null;
          if (data.marking_year !== undefined) r._raw.marking_year = data.marking_year ?? null;
          if (data.origin !== undefined) r._raw.origin = data.origin ?? null;
          if (data.status !== undefined) r._raw.status = data.status;
          if (data.race !== undefined) r._raw.race = data.race ?? null;
          if (data.quality !== undefined) r._raw.quality = data.quality ?? null;
          if (data.fertilized !== undefined) r._raw.fertilized = data.fertilized;
          if (data.clipped !== undefined) r._raw.clipped = data.clipped;
          if (data.birth_date !== undefined) r._raw.birth_date = data.birth_date ?? null;
          if (data.introduced_date !== undefined)
            r._raw.introduced_date = data.introduced_date ?? null;
          if (data.replaced_date !== undefined)
            r._raw.replaced_date = data.replaced_date ?? null;
          if (data.notes !== undefined) r._raw.notes = data.notes ?? null;
        });
      });
      syncAfterWrite();
    },
    [],
  );
  return useMutationWrapper(fn);
}
