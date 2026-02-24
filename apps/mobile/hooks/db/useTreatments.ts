import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { database } from "../../database";
import Treatment from "../../database/models/Treatment";
import type { CreateTreatmentInput, UpdateTreatmentInput } from "../../services/api.types";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";

const treatmentsCollection = database.get<Treatment>("treatments");

export function useTreatments(hiveId?: string) {
  const observable = useMemo(
    () =>
      hiveId
        ? treatmentsCollection.query(Q.where("hive_id", hiveId)).observe()
        : treatmentsCollection.query().observe(),
    [hiveId],
  );
  return useObservable(observable);
}

export function useTreatment(id: string) {
  const observable = useMemo(
    () => (id ? treatmentsCollection.findAndObserve(id) : null),
    [id],
  );
  return useObservable(observable);
}

export function useCreateTreatment() {
  const fn = useCallback(async (data: CreateTreatmentInput) => {
    await database.write(async () => {
      await treatmentsCollection.create((record) => {
        record._raw.hive_id = data.hive_id;
        record._raw.treatment_type = data.treatment_type;
        if (data.product_name) record._raw.product_name = data.product_name;
        if (data.method) record._raw.method = data.method;
        if (data.started_at)
          record._raw.started_at = new Date(data.started_at).getTime();
        if (data.ended_at)
          record._raw.ended_at = new Date(data.ended_at).getTime();
        if (data.dosage) record._raw.dosage = data.dosage;
        if (data.effectiveness_notes)
          record._raw.effectiveness_notes = data.effectiveness_notes;
        if (data.follow_up_date) record._raw.follow_up_date = data.follow_up_date;
      });
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}

export function useUpdateTreatment() {
  const fn = useCallback(
    async ({ id, data }: { id: string; data: UpdateTreatmentInput }) => {
      const record = await treatmentsCollection.find(id);
      await database.write(async () => {
        await record.update((r) => {
          if (data.treatment_type !== undefined)
            r._raw.treatment_type = data.treatment_type;
          if (data.product_name !== undefined)
            r._raw.product_name = data.product_name ?? null;
          if (data.method !== undefined) r._raw.method = data.method ?? null;
          if (data.started_at !== undefined)
            r._raw.started_at = data.started_at
              ? new Date(data.started_at).getTime()
              : null;
          if (data.ended_at !== undefined)
            r._raw.ended_at = data.ended_at
              ? new Date(data.ended_at).getTime()
              : null;
          if (data.dosage !== undefined) r._raw.dosage = data.dosage ?? null;
          if (data.effectiveness_notes !== undefined)
            r._raw.effectiveness_notes = data.effectiveness_notes ?? null;
          if (data.follow_up_date !== undefined)
            r._raw.follow_up_date = data.follow_up_date ?? null;
        });
      });
      syncAfterWrite();
    },
    [],
  );
  return useMutationWrapper(fn);
}

export function useDeleteTreatment() {
  const fn = useCallback(async (id: string) => {
    const record = await treatmentsCollection.find(id);
    await database.write(async () => {
      await record.markAsDeleted();
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}
