import { useMemo, useCallback } from "react";
import { Q } from "@nozbe/watermelondb";
import { database } from "../../database";
import Task from "../../database/models/Task";
import type { CreateTaskInput, UpdateTaskInput } from "../../services/api.types";
import { syncAfterWrite } from "../../database/syncAfterWrite";
import { useObservable } from "./useObservable";
import { useMutationWrapper } from "./useMutationWrapper";
import type { RawRecord } from "@nozbe/watermelondb/RawRecord";

interface TaskRaw extends RawRecord {
  hive_id: string | null;
  apiary_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  recurring: boolean;
  recurrence_rule: string | null;
  source: string;
  completed_at: number | null;
  priority: string;
}

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
        const raw = record._raw as TaskRaw;
        raw.title = data.title;
        if (data.description) raw.description = data.description;
        if (data.hiveId) raw.hive_id = data.hiveId;
        if (data.apiaryId) raw.apiary_id = data.apiaryId;
        if (data.dueDate) raw.due_date = data.dueDate;
        raw.recurring = data.recurring ?? false;
        if (data.recurrenceRule)
          raw.recurrence_rule = data.recurrenceRule;
        raw.source = "manual";
        raw.priority = data.priority ?? "medium";
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
          const raw = r._raw as TaskRaw;
          if (data.title !== undefined) raw.title = data.title;
          if (data.description !== undefined)
            raw.description = data.description ?? null;
          if (data.dueDate !== undefined)
            raw.due_date = data.dueDate ?? null;
          if (data.completedAt !== undefined)
            raw.completed_at = data.completedAt
              ? new Date(data.completedAt).getTime()
              : null;
          if (data.priority !== undefined) raw.priority = data.priority;
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
