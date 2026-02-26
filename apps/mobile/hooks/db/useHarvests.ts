import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { database } from "../../database";
import Harvest from "../../database/models/Harvest";
import type { CreateHarvestInput, UpdateHarvestInput } from "../../services/api.types";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";

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
        record._raw.hive_id = data.hive_id;
        if (data.harvested_at)
          record._raw.harvested_at = new Date(data.harvested_at).getTime();
        if (data.weight_kg != null) record._raw.weight_kg = data.weight_kg;
        if (data.moisture_percent != null)
          record._raw.moisture_percent = data.moisture_percent;
        if (data.honey_type) record._raw.honey_type = data.honey_type;
        if (data.flavor_notes) record._raw.flavor_notes = data.flavor_notes;
        if (data.color) record._raw.color = data.color;
        if (data.frames_harvested != null)
          record._raw.frames_harvested = data.frames_harvested;
        if (data.notes) record._raw.notes = data.notes;
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
          if (data.harvested_at !== undefined)
            r._raw.harvested_at = data.harvested_at
              ? new Date(data.harvested_at).getTime()
              : null;
          if (data.weight_kg !== undefined) r._raw.weight_kg = data.weight_kg ?? null;
          if (data.moisture_percent !== undefined)
            r._raw.moisture_percent = data.moisture_percent ?? null;
          if (data.honey_type !== undefined)
            r._raw.honey_type = data.honey_type ?? null;
          if (data.flavor_notes !== undefined)
            r._raw.flavor_notes = data.flavor_notes ?? null;
          if (data.color !== undefined) r._raw.color = data.color ?? null;
          if (data.frames_harvested !== undefined)
            r._raw.frames_harvested = data.frames_harvested ?? null;
          if (data.notes !== undefined) r._raw.notes = data.notes ?? null;
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
