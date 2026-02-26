import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { database } from "../../database";
import Task from "../../database/models/Task";
import type { CreateTaskInput, UpdateTaskInput } from "../../services/api.types";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";

const tasksCollection = database.get<Task>("tasks");

export function useTasks(filters?: { hive_id?: string; apiary_id?: string }) {
  const observable = useMemo(() => {
    const conditions: Q.Clause[] = [];
    if (filters?.hive_id) conditions.push(Q.where("hive_id", filters.hive_id));
    if (filters?.apiary_id)
      conditions.push(Q.where("apiary_id", filters.apiary_id));
    return tasksCollection.query(...conditions).observe();
  }, [filters?.hive_id, filters?.apiary_id]);
  return useObservable(observable);
}

export function useTask(id: string) {
  const observable = useMemo(
    () => (id ? tasksCollection.findAndObserve(id) : null),
    [id],
  );
  return useObservable(observable);
}

export function useCreateTask() {
  const fn = useCallback(async (data: CreateTaskInput) => {
    await database.write(async () => {
      await tasksCollection.create((record) => {
        record._raw.title = data.title;
        if (data.description) record._raw.description = data.description;
        if (data.hive_id) record._raw.hive_id = data.hive_id;
        if (data.apiary_id) record._raw.apiary_id = data.apiary_id;
        if (data.due_date) record._raw.due_date = data.due_date;
        record._raw.recurring = data.recurring ?? false;
        if (data.recurrence_rule)
          record._raw.recurrence_rule = data.recurrence_rule;
        record._raw.source = "manual";
        record._raw.priority = data.priority ?? "medium";
      });
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}

export function useUpdateTask() {
  const fn = useCallback(
    async ({ id, data }: { id: string; data: UpdateTaskInput }) => {
      const record = await tasksCollection.find(id);
      await database.write(async () => {
        await record.update((r) => {
          if (data.title !== undefined) r._raw.title = data.title;
          if (data.description !== undefined)
            r._raw.description = data.description ?? null;
          if (data.due_date !== undefined)
            r._raw.due_date = data.due_date ?? null;
          if (data.completed_at !== undefined)
            r._raw.completed_at = data.completed_at
              ? new Date(data.completed_at).getTime()
              : null;
          if (data.priority !== undefined) r._raw.priority = data.priority;
        });
      });
      syncAfterWrite();
    },
    [],
  );
  return useMutationWrapper(fn);
}

export function useDeleteTask() {
  const fn = useCallback(async (id: string) => {
    const record = await tasksCollection.find(id);
    await database.write(async () => {
      await record.markAsDeleted();
    });
    syncAfterWrite();
  }, []);
  return useMutationWrapper(fn);
}
