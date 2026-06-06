import { writable, derived, get } from 'svelte/store';
import type { Model, Step, StorageData, FlowStatus, DentureType, ReminderLog, ReminderDays, DeliveryDateHistory, QualityInspection, QualityStatus, InspectionResult } from './types';
import { DEFAULT_REMINDER_DAYS } from './types';
import { loadFromStorage, saveToStorage } from './storage';
import { generateId, todayStr, daysRemaining, getDeliveryStatus } from './formatters';

const emptyData: StorageData = {
  models: [],
  steps: [],
  reminderLogs: [],
  qualityInspections: [],
  updatedAt: ''
};

const stored = typeof window !== 'undefined' ? loadFromStorage() : null;
const initial: StorageData = stored || emptyData;

export const models = writable<Model[]>(initial.models);
export const steps = writable<Step[]>(initial.steps);
export const reminderLogs = writable<ReminderLog[]>(initial.reminderLogs);
export const qualityInspections = writable<QualityInspection[]>(initial.qualityInspections);

function persist() {
  saveToStorage({
    models: get(models),
    steps: get(steps),
    reminderLogs: get(reminderLogs),
    qualityInspections: get(qualityInspections),
    updatedAt: new Date().toISOString()
  });
}

if (typeof window !== 'undefined') {
  models.subscribe(() => persist());
  steps.subscribe(() => persist());
  reminderLogs.subscribe(() => persist());
  qualityInspections.subscribe(() => persist());
}

export function addModel(data: Omit<Model, 'id' | 'createdAt' | 'updatedAt' | 'reminded' | 'deliveryDateHistory'> & { reminded?: boolean; deliveryDateHistory?: DeliveryDateHistory[] }): Model {
  const now = new Date().toISOString();
  const newModel: Model = {
    reminderDays: DEFAULT_REMINDER_DAYS,
    reminded: false,
    deliveryDateHistory: [],
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
  qualityInspections.update((list) => list.filter((q) => q.modelId !== id));
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

export const upcomingModels = derived(
  [models],
  ([$models]) => {
    return $models.filter((m) => {
      if (m.status === 'DELIVERED' || m.status === 'CANCELLED') return false;
      const remaining = daysRemaining(m.expectedDeliveryDate);
      const reminderDays = m.reminderDays ?? DEFAULT_REMINDER_DAYS;
      return remaining >= 0 && remaining <= reminderDays;
    });
  }
);

export const upcomingAndOverdueModels = derived(
  [models],
  ([$models]) => {
    return $models.filter((m) => {
      const status = getDeliveryStatus(
        m.expectedDeliveryDate,
        m.status,
        m.reminderDays ?? DEFAULT_REMINDER_DAYS
      );
      return status !== 'NORMAL';
    });
  }
);

export const delayReasonStats = derived(
  [models],
  ([$models]) => {
    const result: Record<string, number> = {};
    for (const m of $models) {
      if (m.delayReason && m.delayReason.trim()) {
        const reason = m.delayReason.trim();
        result[reason] = (result[reason] || 0) + 1;
      }
    }
    return result;
  }
);

export const totalRescheduleCount = derived(
  [models],
  ([$models]) => {
    let total = 0;
    for (const m of $models) {
      total += (m.deliveryDateHistory?.length || 0);
    }
    return total;
  }
);

export function markAsReminded(modelId: string): void {
  const now = new Date().toISOString();
  updateModel(modelId, { reminded: true, remindedAt: now });
  const model = getModelById(modelId);
  if (model) {
    const status = getDeliveryStatus(
      model.expectedDeliveryDate,
      model.status,
      model.reminderDays ?? DEFAULT_REMINDER_DAYS
    );
    reminderLogs.update((list) => [
      ...list,
      {
        id: generateId(),
        modelId,
        remindedAt: now,
        type: status === 'OVERDUE' ? 'OVERDUE' : 'UPCOMING'
      }
    ]);
  }
}

export function rescheduleDeliveryDate(
  modelId: string,
  newDate: string,
  reason: string,
  changedBy: string = '系统'
): void {
  const model = getModelById(modelId);
  if (!model) return;

  const now = new Date().toISOString();
  const historyEntry: DeliveryDateHistory = {
    id: generateId(),
    previousDate: model.expectedDeliveryDate,
    newDate,
    reason,
    changedAt: now,
    changedBy
  };

  updateModel(modelId, {
    expectedDeliveryDate: newDate,
    delayReason: reason,
    reminded: false,
    remindedAt: undefined,
    deliveryDateHistory: [...(model.deliveryDateHistory || []), historyEntry]
  });
}

export function updateReminderDays(modelId: string, days: ReminderDays): void {
  updateModel(modelId, { reminderDays: days });
}

export function updateDelayReason(modelId: string, reason: string): void {
  updateModel(modelId, { delayReason: reason });
}

export function addQualityInspection(
  data: Omit<QualityInspection, 'id' | 'createdAt'>
): QualityInspection {
  const now = new Date().toISOString();
  const newInspection: QualityInspection = {
    ...data,
    id: generateId(),
    createdAt: now
  };
  qualityInspections.update((list) => [...list, newInspection]);
  return newInspection;
}

export function getQualityInspectionsByModelId(modelId: string): QualityInspection[] {
  return get(qualityInspections)
    .filter((q) => q.modelId === modelId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getLatestQualityInspection(modelId: string): QualityInspection | undefined {
  const inspections = getQualityInspectionsByModelId(modelId);
  return inspections.length > 0 ? inspections[0] : undefined;
}

export function getQualityStatus(model: Model): QualityStatus {
  if (model.status === 'CANCELLED' || model.status === 'DELIVERED') return 'NONE';
  const modelSteps = getStepsByModelId(model.id);
  const stepsCompleted = modelSteps.length > 0 && modelSteps.every((s) => s.completed);
  const needsInspection = stepsCompleted || model.status === 'TRIAL';
  const latest = getLatestQualityInspection(model.id);
  if (!latest) {
    return needsInspection ? 'PENDING' : 'NONE';
  }
  return latest.result === 'PASS' ? 'PASSED_PENDING_DELIVERY' : 'FAILED';
}

export function hasPassedQualityInspection(modelId: string): boolean {
  const latest = getLatestQualityInspection(modelId);
  return latest?.result === 'PASS';
}

export const pendingQualityInspectionCount = derived(
  [models, steps, qualityInspections],
  ([$models, $steps, $qualityInspections]) => {
    let count = 0;
    for (const m of $models) {
      if (m.status === 'DELIVERED' || m.status === 'CANCELLED') continue;
      const modelSteps = $steps.filter((s) => s.modelId === m.id);
      const stepsCompleted = modelSteps.length > 0 && modelSteps.every((s) => s.completed);
      if (!stepsCompleted && m.status !== 'TRIAL') continue;
      const latest = $qualityInspections
        .filter((q) => q.modelId === m.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (!latest) count++;
    }
    return count;
  }
);

export const qualityInspectionPassRate = derived(
  [models, qualityInspections],
  ([$models, $qualityInspections]) => {
    const inspectedModelIds = new Set<string>();
    let passedCount = 0;
    for (const m of $models) {
      const inspections = $qualityInspections
        .filter((q) => q.modelId === m.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (inspections.length > 0) {
        inspectedModelIds.add(m.id);
        if (inspections[0].result === 'PASS') passedCount++;
      }
    }
    const total = inspectedModelIds.size;
    if (total === 0) return { rate: 0, total: 0, passed: 0 };
    return {
      rate: Math.round((passedCount / total) * 100),
      total,
      passed: passedCount
    };
  }
);

export const totalReworkCount = derived(
  [qualityInspections],
  ([$qualityInspections]) => {
    return $qualityInspections.filter((q) => q.result === 'FAIL').length;
  }
);

export const qualityFailedCount = derived(
  [models, qualityInspections],
  ([$models, $qualityInspections]) => {
    let count = 0;
    for (const m of $models) {
      if (m.status === 'DELIVERED' || m.status === 'CANCELLED') continue;
      const inspections = $qualityInspections
        .filter((q) => q.modelId === m.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (inspections.length > 0 && inspections[0].result === 'FAIL') count++;
    }
    return count;
  }
);

export const qualityPassedPendingDeliveryCount = derived(
  [models, qualityInspections],
  ([$models, $qualityInspections]) => {
    let count = 0;
    for (const m of $models) {
      if (m.status === 'DELIVERED' || m.status === 'CANCELLED') continue;
      const inspections = $qualityInspections
        .filter((q) => q.modelId === m.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (inspections.length > 0 && inspections[0].result === 'PASS') count++;
    }
    return count;
  }
);
