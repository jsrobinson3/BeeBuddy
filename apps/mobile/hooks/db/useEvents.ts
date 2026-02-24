import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { database } from "../../database";
import Event from "../../database/models/Event";
import type { CreateEventInput, UpdateEventInput } from "../../services/api.types";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";

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
        record._raw.hive_id = data.hive_id;
        record._raw.event_type = data.event_type;
        record._raw.occurred_at = data.occurred_at
          ? new Date(data.occurred_at).getTime()
          : Date.now();
        if (data.details)
          record._raw.details_json = JSON.stringify(data.details);
        if (data.notes) record._raw.notes = data.notes;
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
          if (data.event_type !== undefined)
            r._raw.event_type = data.event_type;
          if (data.occurred_at !== undefined)
            r._raw.occurred_at = new Date(data.occurred_at).getTime();
          if (data.details !== undefined)
            r._raw.details_json = data.details
              ? JSON.stringify(data.details)
              : null;
          if (data.notes !== undefined) r._raw.notes = data.notes ?? null;
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
