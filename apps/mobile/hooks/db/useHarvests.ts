import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { database } from "../../database";
import Harvest from "../../database/models/Harvest";
import type { CreateHarvestInput, UpdateHarvestInput } from "../../services/api.types";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";
import type { RawRecord } from "@nozbe/watermelondb/RawRecord";

interface HarvestRaw extends RawRecord {
  hive_id: string;
  harvested_at: number | null;
  weight_kg: number | null;
  moisture_percent: number | null;
  honey_type: string | null;
  flavor_notes: string | null;
  color: string | null;
  frames_harvested: number | null;
  notes: string | null;
}

const harvestsCollection = database.get<Harvest>("harvests");

export function useHarvests(hiveId?: string) {
  const observable = useMemo(
    () =>
      hiveId
        ? harvestsCollection.query(Q.where("hive_id", hiveId)).observe()
        : harvestsCollection.query().observe(),
    [hiveId],
  );
  return useObservable(observable);
}

export function useHarvest(id: string) {
  const observable = useMemo(
    () => (id ? harvestsCollection.findAndObserve(id) : null),
    [id],
  );
  return useObservable(observable);
}

export function useCreateHarvest() {
  const fn = useCallback(async (data: CreateHarvestInput) => {
    await database.write(async () => {
      await harvestsCollection.create((record) => {
        const raw = record._raw as HarvestRaw;
        raw.hive_id = data.hiveId;
        if (data.harvestedAt)
          raw.harvested_at = new Date(data.harvestedAt).getTime();
        if (data.weightKg != null) raw.weight_kg = data.weightKg;
        if (data.moisturePercent != null)
          raw.moisture_percent = data.moisturePercent;
        if (data.honeyType) raw.honey_type = data.honeyType;
        if (data.flavorNotes) raw.flavor_notes = data.flavorNotes;
        if (data.color) raw.color = data.color;
        if (data.framesHarvested != null)
          raw.frames_harvested = data.framesHarvested;
        if (data.notes) raw.notes = data.notes;
      });
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}

export function useUpdateHarvest() {
  const fn = useCallback(
    async ({ id, data }: { id: string; data: UpdateHarvestInput }) => {
      const record = await harvestsCollection.find(id);
      await database.write(async () => {
        await record.update((r) => {
          const raw = r._raw as HarvestRaw;
          if (data.harvestedAt !== undefined)
            raw.harvested_at = data.harvestedAt
              ? new Date(data.harvestedAt).getTime()
              : null;
          if (data.weightKg !== undefined) raw.weight_kg = data.weightKg ?? null;
          if (data.moisturePercent !== undefined)
            raw.moisture_percent = data.moisturePercent ?? null;
          if (data.honeyType !== undefined)
            raw.honey_type = data.honeyType ?? null;
          if (data.flavorNotes !== undefined)
            raw.flavor_notes = data.flavorNotes ?? null;
          if (data.color !== undefined) raw.color = data.color ?? null;
          if (data.framesHarvested !== undefined)
            raw.frames_harvested = data.framesHarvested ?? null;
          if (data.notes !== undefined) raw.notes = data.notes ?? null;
        });
      });
      syncAfterWrite();
    },
    [],
  );
  return useMutationWrapper(fn);
}

export function useDeleteHarvest() {
  const fn = useCallback(async (id: string) => {
    const record = await harvestsCollection.find(id);
    await database.write(async () => {
      await record.markAsDeleted();
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}
