import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { database } from "../../database";
import Treatment from "../../database/models/Treatment";
import type { CreateTreatmentInput, UpdateTreatmentInput } from "../../services/api.types";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";
import type { RawRecord } from "@nozbe/watermelondb/RawRecord";

interface TreatmentRaw extends RawRecord {
  hive_id: string;
  treatment_type: string;
  product_name: string | null;
  method: string | null;
  started_at: number | null;
  ended_at: number | null;
  dosage: string | null;
  effectiveness_notes: string | null;
  follow_up_date: string | null;
}

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
        const raw = record._raw as TreatmentRaw;
        raw.hive_id = data.hiveId;
        raw.treatment_type = data.treatmentType;
        if (data.productName) raw.product_name = data.productName;
        if (data.method) raw.method = data.method;
        if (data.startedAt)
          raw.started_at = new Date(data.startedAt).getTime();
        if (data.endedAt)
          raw.ended_at = new Date(data.endedAt).getTime();
        if (data.dosage) raw.dosage = data.dosage;
        if (data.effectivenessNotes)
          raw.effectiveness_notes = data.effectivenessNotes;
        if (data.followUpDate) raw.follow_up_date = data.followUpDate;
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
          const raw = r._raw as TreatmentRaw;
          if (data.treatmentType !== undefined)
            raw.treatment_type = data.treatmentType;
          if (data.productName !== undefined)
            raw.product_name = data.productName ?? null;
          if (data.method !== undefined) raw.method = data.method ?? null;
          if (data.startedAt !== undefined)
            raw.started_at = data.startedAt
              ? new Date(data.startedAt).getTime()
              : null;
          if (data.endedAt !== undefined)
            raw.ended_at = data.endedAt
              ? new Date(data.endedAt).getTime()
              : null;
          if (data.dosage !== undefined) raw.dosage = data.dosage ?? null;
          if (data.effectivenessNotes !== undefined)
            raw.effectiveness_notes = data.effectivenessNotes ?? null;
          if (data.followUpDate !== undefined)
            raw.follow_up_date = data.followUpDate ?? null;
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
