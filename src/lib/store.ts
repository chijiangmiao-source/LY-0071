import { writable, derived, get } from 'svelte/store';
import type { Model, Step, StorageData, FlowStatus, DentureType } from './types';
import { loadFromStorage, saveToStorage } from './storage';
import { generateId, todayStr } from './formatters';

const emptyData: StorageData = {
  models: [],
  steps: [],
  updatedAt: ''
};

const stored = typeof window !== 'undefined' ? loadFromStorage() : null;
const initial: StorageData = stored || emptyData;

export const models = writable<Model[]>(initial.models);
export const steps = writable<Step[]>(initial.steps);

function persist() {
  saveToStorage({
    models: get(models),
    steps: get(steps),
    updatedAt: new Date().toISOString()
  });
}

if (typeof window !== 'undefined') {
  models.subscribe(() => persist());
  steps.subscribe(() => persist());
}

export function addModel(data: Omit<Model, 'id' | 'createdAt' | 'updatedAt'>): Model {
  const now = new Date().toISOString();
  const newModel: Model = {
    ...data,
    id: generateId(),
    createdAt: now,
    updatedAt: now
  };
  models.update((list) => [...list, newModel]);
  return newModel;
}

export function updateModel(id: string, data: Partial<Model>): void {
  models.update((list) =>
    list.map((m) => (m.id === id ? { ...m, ...data, updatedAt: new Date().toISOString() } : m))
  );
}

export function deleteModel(id: string): void {
  models.update((list) => list.filter((m) => m.id !== id));
  steps.update((list) => list.filter((s) => s.modelId !== id));
}

export function getModelById(id: string): Model | undefined {
  return get(models).find((m) => m.id === id);
}

export function addStep(data: Omit<Step, 'id'>): Step {
  const newStep: Step = { ...data, id: generateId() };
  steps.update((list) => [...list, newStep]);
  return newStep;
}

export function updateStep(id: string, data: Partial<Step>): void {
  steps.update((list) =>
    list.map((s) => {
      if (s.id !== id) return s;
      const updated = { ...s, ...data };
      if (data.completed === true && !s.completed) {
        updated.completedAt = new Date().toISOString();
      } else if (data.completed === false) {
        updated.completedAt = undefined;
      }
      return updated;
    })
  );
}

export function deleteStep(id: string): void {
  steps.update((list) => list.filter((s) => s.id !== id));
}

export function getStepsByModelId(modelId: string): Step[] {
  return get(steps).filter((s) => s.modelId === modelId);
}

export function toggleStepComplete(id: string): void {
  steps.update((list) =>
    list.map((s) => {
      if (s.id !== id) return s;
      const completed = !s.completed;
      return {
        ...s,
        completed,
        completedAt: completed ? new Date().toISOString() : undefined
      };
    })
  );
}

export function updateModelStatus(modelId: string, status: FlowStatus): void {
  updateModel(modelId, { status });
}

export const modelsByStatus = derived(models, ($models) => {
  const result: Record<FlowStatus, number> = {
    PENDING: 0,
    IN_PROGRESS: 0,
    TRIAL: 0,
    DELIVERED: 0,
    CANCELLED: 0
  };
  for (const m of $models) {
    result[m.status]++;
  }
  return result;
});

export const dentureTypeStats = derived(models, ($models) => {
  const result: Partial<Record<DentureType, number>> = {};
  for (const m of $models) {
    result[m.dentureType] = (result[m.dentureType] || 0) + 1;
  }
  return result;
});

export const overdueModels = derived(
  [models],
  ([$models]) => {
    const today = todayStr();
    return $models.filter(
      (m) =>
        (m.status === 'PENDING' || m.status === 'IN_PROGRESS' || m.status === 'TRIAL') &&
        m.expectedDeliveryDate < today
    );
  }
);
