import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { database } from "../../database";
import Queen from "../../database/models/Queen";
import type { CreateQueenInput, UpdateQueenInput } from "../../services/api.types";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";
import type { RawRecord } from "@nozbe/watermelondb/RawRecord";

interface QueenRaw extends RawRecord {
  hive_id: string;
  marking_color: string | null;
  marking_year: number | null;
  origin: string | null;
  status: string;
  race: string | null;
  quality: number | null;
  fertilized: boolean;
  clipped: boolean;
  birth_date: string | null;
  introduced_date: string | null;
  replaced_date: string | null;
  notes: string | null;
}

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
        const raw = record._raw as QueenRaw;
        raw.hive_id = data.hiveId;
        if (data.markingColor) raw.marking_color = data.markingColor;
        if (data.markingYear != null) raw.marking_year = data.markingYear;
        if (data.origin) raw.origin = data.origin;
        raw.status = data.status ?? "present";
        if (data.race) raw.race = data.race;
        if (data.quality != null) raw.quality = data.quality;
        raw.fertilized = data.fertilized ?? false;
        raw.clipped = data.clipped ?? false;
        if (data.birthDate) raw.birth_date = data.birthDate;
        if (data.introducedDate) raw.introduced_date = data.introducedDate;
        if (data.notes) raw.notes = data.notes;
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
          const raw = r._raw as QueenRaw;
          if (data.markingColor !== undefined) raw.marking_color = data.markingColor ?? null;
          if (data.markingYear !== undefined) raw.marking_year = data.markingYear ?? null;
          if (data.origin !== undefined) raw.origin = data.origin ?? null;
          if (data.status !== undefined) raw.status = data.status;
          if (data.race !== undefined) raw.race = data.race ?? null;
          if (data.quality !== undefined) raw.quality = data.quality ?? null;
          if (data.fertilized !== undefined) raw.fertilized = data.fertilized;
          if (data.clipped !== undefined) raw.clipped = data.clipped;
          if (data.birthDate !== undefined) raw.birth_date = data.birthDate ?? null;
          if (data.introducedDate !== undefined)
            raw.introduced_date = data.introducedDate ?? null;
          if (data.replacedDate !== undefined)
            raw.replaced_date = data.replacedDate ?? null;
          if (data.notes !== undefined) raw.notes = data.notes ?? null;
        });
      });
      syncAfterWrite();
    },
    [],
  );
  return useMutationWrapper(fn);
}
