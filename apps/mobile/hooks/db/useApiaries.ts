import { useMemo, useCallback } from "react";
import { database } from "../../database";
import Apiary from "../../database/models/Apiary";
import type { CreateApiaryInput, UpdateApiaryInput } from "../../services/api.types";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";

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
        record.name = data.name;
        if (data.latitude != null) record._raw.latitude = data.latitude;
        if (data.longitude != null) record._raw.longitude = data.longitude;
        if (data.city) record._raw.city = data.city;
        if (data.country_code) record._raw.country_code = data.country_code;
        if (data.hex_color) record._raw.hex_color = data.hex_color;
        if (data.notes) record._raw.notes = data.notes;
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
          if (data.name !== undefined) r.name = data.name;
          if (data.latitude !== undefined) r._raw.latitude = data.latitude ?? null;
          if (data.longitude !== undefined) r._raw.longitude = data.longitude ?? null;
          if (data.city !== undefined) r._raw.city = data.city ?? null;
          if (data.country_code !== undefined) r._raw.country_code = data.country_code ?? null;
          if (data.hex_color !== undefined) r._raw.hex_color = data.hex_color ?? null;
          if (data.notes !== undefined) r._raw.notes = data.notes ?? null;
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
