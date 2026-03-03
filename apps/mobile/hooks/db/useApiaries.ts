import { useMemo, useCallback } from "react";
import { database } from "../../database";
import Apiary from "../../database/models/Apiary";
import type { CreateApiaryInput, UpdateApiaryInput } from "../../services/api.types";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";
import type { RawRecord } from "@nozbe/watermelondb/RawRecord";

interface ApiaryRaw extends RawRecord {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  country_code: string | null;
  hex_color: string | null;
  notes: string | null;
}

const apiariesCollection = database.get<Apiary>("apiaries");

export function useApiaries() {
  const observable = useMemo(() => apiariesCollection.query().observe(), []);
  return useObservable(observable);
}

export function useApiary(id: string) {
  const observable = useMemo(
    () => (id ? apiariesCollection.findAndObserve(id) : null),
    [id],
  );
  return useObservable(observable);
}

export function useCreateApiary() {
  const fn = useCallback(async (data: CreateApiaryInput) => {
    await database.write(async () => {
      await apiariesCollection.create((record) => {
        const raw = record._raw as ApiaryRaw;
        record.name = data.name;
        if (data.latitude != null) raw.latitude = data.latitude;
        if (data.longitude != null) raw.longitude = data.longitude;
        if (data.city) raw.city = data.city;
        if (data.countryCode) raw.country_code = data.countryCode;
        if (data.hexColor) raw.hex_color = data.hexColor;
        if (data.notes) raw.notes = data.notes;
      });
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}

export function useUpdateApiary() {
  const fn = useCallback(
    async ({ id, data }: { id: string; data: UpdateApiaryInput }) => {
      const record = await apiariesCollection.find(id);
      await database.write(async () => {
        await record.update((r) => {
          const raw = r._raw as ApiaryRaw;
          if (data.name !== undefined) r.name = data.name;
          if (data.latitude !== undefined) raw.latitude = data.latitude ?? null;
          if (data.longitude !== undefined) raw.longitude = data.longitude ?? null;
          if (data.city !== undefined) raw.city = data.city ?? null;
          if (data.countryCode !== undefined) raw.country_code = data.countryCode ?? null;
          if (data.hexColor !== undefined) raw.hex_color = data.hexColor ?? null;
          if (data.notes !== undefined) raw.notes = data.notes ?? null;
        });
      });
      syncAfterWrite();
    },
    [],
  );
  return useMutationWrapper(fn);
}

export function useDeleteApiary() {
  const fn = useCallback(async (id: string) => {
    const record = await apiariesCollection.find(id);
    await database.write(async () => {
      await record.markAsDeleted();
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}
