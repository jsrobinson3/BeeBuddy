import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { database } from "../../database";
import Event from "../../database/models/Event";
import type { CreateEventInput, UpdateEventInput } from "../../services/api.types";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";
import type { RawRecord } from "@nozbe/watermelondb/RawRecord";

interface EventRaw extends RawRecord {
  hive_id: string;
  event_type: string;
  occurred_at: number;
  details_json: string | null;
  notes: string | null;
}

const eventsCollection = database.get<Event>("events");

export function useEvents(hiveId?: string) {
  const observable = useMemo(
    () =>
      hiveId
        ? eventsCollection.query(Q.where("hive_id", hiveId)).observe()
        : eventsCollection.query().observe(),
    [hiveId],
  );
  return useObservable(observable);
}

export function useEvent(id: string) {
  const observable = useMemo(
    () => (id ? eventsCollection.findAndObserve(id) : null),
    [id],
  );
  return useObservable(observable);
}

export function useCreateEvent() {
  const fn = useCallback(async (data: CreateEventInput) => {
    await database.write(async () => {
      await eventsCollection.create((record) => {
        const raw = record._raw as EventRaw;
        raw.hive_id = data.hiveId;
        raw.event_type = data.eventType;
        raw.occurred_at = data.occurredAt
          ? new Date(data.occurredAt).getTime()
          : Date.now();
        if (data.details)
          raw.details_json = JSON.stringify(data.details);
        if (data.notes) raw.notes = data.notes;
      });
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}

export function useUpdateEvent() {
  const fn = useCallback(
    async ({ id, data }: { id: string; data: UpdateEventInput }) => {
      const record = await eventsCollection.find(id);
      await database.write(async () => {
        await record.update((r) => {
          const raw = r._raw as EventRaw;
          if (data.eventType !== undefined)
            raw.event_type = data.eventType;
          if (data.occurredAt !== undefined)
            raw.occurred_at = new Date(data.occurredAt).getTime();
          if (data.details !== undefined)
            raw.details_json = data.details
              ? JSON.stringify(data.details)
              : null;
          if (data.notes !== undefined) raw.notes = data.notes ?? null;
        });
      });
      syncAfterWrite();
    },
    [],
  );
  return useMutationWrapper(fn);
}

export function useDeleteEvent() {
  const fn = useCallback(async (id: string) => {
    const record = await eventsCollection.find(id);
    await database.write(async () => {
      await record.markAsDeleted();
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}
