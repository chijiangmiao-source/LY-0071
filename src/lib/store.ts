import { writable, derived, get } from 'svelte/store';
import type {
  Model,
  Step,
  StorageData,
  FlowStatus,
  DentureType,
  ReminderLog,
  ReminderDays,
  DeliveryDateHistory,
  QualityInspection,
  QualityStatus,
  InspectionResult,
  ReworkRecord,
  ReworkStatus,
  BatchOperation,
  BatchOperationRecord,
  BatchActionType
} from './types';
import { DEFAULT_REMINDER_DAYS, FLOW_STATUS_LABEL, DENTURE_TYPE_LABEL, QUALITY_STATUS_LABEL, BATCH_ACTION_TYPE_LABEL } from './types';
import { loadFromStorage, saveToStorage } from './storage';
import { generateId, todayStr, formatDate, getDeliveryStatus } from './formatters';
import {
  canTransitionTo as domainCanTransitionTo,
  canMarkDelivered as domainCanMarkDelivered
} from './domain/statusRules';
import {
  getQualityStatus as domainGetQualityStatus,
  getLatestInspection as domainGetLatestInspection,
  hasPassedLatestInspection,
  getActiveRework as domainGetActiveRework
} from './domain/qualityRules';
import {
  validateBatchAction as domainValidateBatchAction,
  getActionFieldName as domainGetActionFieldName,
  getActionNewValue as domainGetActionNewValue
} from './domain/batchRules';
import {
  countModelsByStatus,
  countDentureType,
  getOverdueModels,
  getUpcomingModels,
  getUpcomingAndOverdueModels,
  getDelayReasonStats,
  getTotalRescheduleCount,
  countPendingQualityInspection,
  getQualityInspectionPassRate,
  countActiveRework,
  countTotalRework,
  countQualityFailed,
  countQualityPassedPendingDelivery,
  getThisWeekBatchOperationCount,
  getThisWeekBatchModifiedModelCount,
  getMostUsedBatchActionType
} from './domain/statsRules';

const emptyData: StorageData = {
  models: [],
  steps: [],
  reminderLogs: [],
  qualityInspections: [],
  reworkRecords: [],
  batchOperations: [],
  batchOperationRecords: [],
  updatedAt: ''
};

const stored = typeof window !== 'undefined' ? loadFromStorage() : null;
const initial: StorageData = stored || emptyData;

export const models = writable<Model[]>(initial.models);
export const steps = writable<Step[]>(initial.steps);
export const reminderLogs = writable<ReminderLog[]>(initial.reminderLogs);
export const qualityInspections = writable<QualityInspection[]>(initial.qualityInspections);
export const reworkRecords = writable<ReworkRecord[]>(initial.reworkRecords);
export const batchOperations = writable<BatchOperation[]>(initial.batchOperations);
export const batchOperationRecords = writable<BatchOperationRecord[]>(initial.batchOperationRecords);

function persist() {
  saveToStorage({
    models: get(models),
    steps: get(steps),
    reminderLogs: get(reminderLogs),
    qualityInspections: get(qualityInspections),
    reworkRecords: get(reworkRecords),
    batchOperations: get(batchOperations),
    batchOperationRecords: get(batchOperationRecords),
    updatedAt: new Date().toISOString()
  });
}

if (typeof window !== 'undefined') {
  models.subscribe(() => persist());
  steps.subscribe(() => persist());
  reminderLogs.subscribe(() => persist());
  qualityInspections.subscribe(() => persist());
  reworkRecords.subscribe(() => persist());
  batchOperations.subscribe(() => persist());
  batchOperationRecords.subscribe(() => persist());
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
  reworkRecords.update((list) => list.filter((r) => r.modelId !== id));
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

export const modelsByStatus = derived(models, ($models) => countModelsByStatus($models));

export const dentureTypeStats = derived(models, ($models) => countDentureType($models));

export const overdueModels = derived([models], ([$models]) => getOverdueModels($models));

export const upcomingModels = derived([models], ([$models]) => getUpcomingModels($models));

export const upcomingAndOverdueModels = derived([models], ([$models]) => getUpcomingAndOverdueModels($models));

export const delayReasonStats = derived([models], ([$models]) => getDelayReasonStats($models));

export const totalRescheduleCount = derived([models], ([$models]) => getTotalRescheduleCount($models));

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
  return domainGetLatestInspection(getQualityInspectionsByModelId(modelId));
}

export function getQualityStatus(model: Model): QualityStatus {
  const modelSteps = getStepsByModelId(model.id);
  const modelInspections = getQualityInspectionsByModelId(model.id);
  const modelReworks = getReworkRecordsByModelId(model.id);
  return domainGetQualityStatus(model, modelSteps, modelInspections, modelReworks);
}

export function hasPassedQualityInspection(modelId: string): boolean {
  return hasPassedLatestInspection(getQualityInspectionsByModelId(modelId));
}

export const pendingQualityInspectionCount = derived(
  [models, steps, qualityInspections, reworkRecords],
  ([$models, $steps, $qualityInspections, $reworkRecords]) =>
    countPendingQualityInspection($models, $steps, $qualityInspections, $reworkRecords)
);

export const qualityInspectionPassRate = derived(
  [models, qualityInspections],
  ([$models, $qualityInspections]) =>
    getQualityInspectionPassRate($models, $qualityInspections)
);

export const totalReworkCount = derived(
  [qualityInspections],
  ([$qualityInspections]) => countTotalRework($qualityInspections)
);

export const qualityFailedCount = derived(
  [models, steps, qualityInspections, reworkRecords],
  ([$models, $steps, $qualityInspections, $reworkRecords]) =>
    countQualityFailed($models, $steps, $qualityInspections, $reworkRecords)
);

export const qualityPassedPendingDeliveryCount = derived(
  [models, steps, qualityInspections, reworkRecords],
  ([$models, $steps, $qualityInspections, $reworkRecords]) =>
    countQualityPassedPendingDelivery($models, $steps, $qualityInspections, $reworkRecords)
);

export function startRework(
  modelId: string,
  inspectionId: string,
  reworkStepId: string,
  reworkStepName: string,
  reworkResponsiblePerson: string
): ReworkRecord {
  const now = new Date().toISOString();
  const record: ReworkRecord = {
    id: generateId(),
    modelId,
    inspectionId,
    reworkStepId,
    reworkStepName,
    reworkResponsiblePerson,
    status: 'IN_PROGRESS',
    startedAt: now
  };
  reworkRecords.update((list) => [...list, record]);

  steps.update((list) =>
    list.map((s) => {
      if (s.modelId !== modelId) return s;
      return {
        ...s,
        completed: false,
        completedAt: undefined
      };
    })
  );

  updateModelStatus(modelId, 'IN_PROGRESS');

  return record;
}

export function completeRework(
  reworkId: string,
  completedBy: string,
  completionRemarks?: string
): void {
  const now = new Date().toISOString();
  reworkRecords.update((list) =>
    list.map((r) => {
      if (r.id !== reworkId) return r;
      return {
        ...r,
        status: 'COMPLETED',
        completedAt: now,
        completedBy,
        completionRemarks: completionRemarks?.trim() || undefined
      };
    })
  );
}

export function getReworkRecordsByModelId(modelId: string): ReworkRecord[] {
  return get(reworkRecords)
    .filter((r) => r.modelId === modelId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function getActiveRework(modelId: string): ReworkRecord | undefined {
  return domainGetActiveRework(getReworkRecordsByModelId(modelId));
}

export const activeReworkCount = derived(
  [reworkRecords],
  ([$reworkRecords]) => countActiveRework($reworkRecords)
);

export function getBatchOperationRecordsByModelId(modelId: string): BatchOperationRecord[] {
  return get(batchOperationRecords)
    .filter((r) => r.modelId === modelId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getBatchOperationById(id: string): BatchOperation | undefined {
  return get(batchOperations).find((op) => op.id === id);
}

export interface BatchExecuteResult {
  batchOperationId: string;
  succeeded: number;
  failed: number;
  failureReasons: Record<string, string>;
  succeededIds: string[];
  failedIds: string[];
}

export function executeBatchOperation(
  modelIds: string[],
  actionType: BatchActionType,
  payload: Record<string, any>,
  operator: string = '系统',
  remark?: string
): BatchExecuteResult {
  const now = new Date().toISOString();
  const batchOpId = generateId();
  const succeededIds: string[] = [];
  const failedIds: string[] = [];
  const failureReasons: Record<string, string> = {};
  const recordsToAdd: BatchOperationRecord[] = [];

  const allModels = get(models);
  const allSteps = get(steps);
  const allInspections = get(qualityInspections);

  for (const modelId of modelIds) {
    const model = allModels.find((m) => m.id === modelId);
    if (!model) {
      failedIds.push(modelId);
      failureReasons[modelId] = '模型不存在';
      continue;
    }

    const modelSteps = allSteps.filter((s) => s.modelId === modelId);
    const modelInspections = allInspections.filter((q) => q.modelId === modelId);

    const check = domainValidateBatchAction(actionType, payload, {
      model,
      steps: modelSteps,
      inspections: modelInspections
    });

    if (!check.valid) {
      failedIds.push(modelId);
      failureReasons[modelId] = check.message || '校验失败';
      continue;
    }

    try {
      const previousValues: Record<string, any> = {};

      switch (actionType) {
        case 'SET_RESPONSIBLE_PERSON': {
          previousValues.responsiblePerson = model.responsiblePerson;
          updateModel(modelId, { responsiblePerson: payload.responsiblePerson.trim() });
          break;
        }

        case 'SET_EXPECTED_DELIVERY_DATE': {
          previousValues.expectedDeliveryDate = model.expectedDeliveryDate;
          const historyEntry: DeliveryDateHistory = {
            id: generateId(),
            previousDate: model.expectedDeliveryDate,
            newDate: payload.expectedDeliveryDate,
            reason: payload.reason || '批量调整交付日期',
            changedAt: now,
            changedBy: operator
          };
          updateModel(modelId, {
            expectedDeliveryDate: payload.expectedDeliveryDate,
            delayReason: payload.reason || model.delayReason,
            reminded: false,
            remindedAt: undefined,
            deliveryDateHistory: [...(model.deliveryDateHistory || []), historyEntry]
          });
          break;
        }

        case 'SET_REMINDER_DAYS': {
          previousValues.reminderDays = model.reminderDays ?? DEFAULT_REMINDER_DAYS;
          updateModel(modelId, { reminderDays: payload.reminderDays });
          break;
        }

        case 'MARK_REMINDED': {
          previousValues.reminded = model.reminded;
          previousValues.remindedAt = model.remindedAt;
          markAsReminded(modelId);
          break;
        }

        case 'SET_FLOW_STATUS': {
          previousValues.status = model.status;
          const targetStatus = payload.status as FlowStatus;
          const transCheck = domainCanTransitionTo(model.status, targetStatus, modelSteps, modelInspections);
          if (!transCheck.valid) {
            failedIds.push(modelId);
            failureReasons[modelId] = transCheck.message || '状态流转不合法';
            continue;
          }
          updateModelStatus(modelId, targetStatus);
          break;
        }

        case 'EXPORT_SUMMARY': {
          break;
        }
      }

      const record: BatchOperationRecord = {
        id: generateId(),
        modelId,
        batchOperationId: batchOpId,
        actionType,
        detail: {
          field: domainGetActionFieldName(actionType),
          previousValue: previousValues[Object.keys(previousValues)[0]] ?? null,
          newValue: domainGetActionNewValue(actionType, payload)
        },
        createdAt: now
      };
      recordsToAdd.push(record);
      succeededIds.push(modelId);
    } catch (e) {
      failedIds.push(modelId);
      failureReasons[modelId] = e instanceof Error ? e.message : '执行失败';
    }
  }

  if (recordsToAdd.length > 0) {
    batchOperationRecords.update((list) => [...list, ...recordsToAdd]);
  }

  const batchOp: BatchOperation = {
    id: batchOpId,
    actionType,
    modelIds,
    succeededIds,
    failedIds,
    failureReasons,
    payload,
    operator,
    remark,
    createdAt: now
  };
  batchOperations.update((list) => [...list, batchOp]);

  return {
    batchOperationId: batchOpId,
    succeeded: succeededIds.length,
    failed: failedIds.length,
    failureReasons,
    succeededIds,
    failedIds
  };
}

export function exportModelsSummary(modelIds: string[]): string {
  const allModels = get(models);
  const allSteps = get(steps);
  const allInspections = get(qualityInspections);

  const lines: string[] = [];
  lines.push('牙科义齿模型批量摘要');
  lines.push(`导出时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`导出模型数: ${modelIds.length}`);
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('');

  for (const modelId of modelIds) {
    const model = allModels.find((m) => m.id === modelId);
    if (!model) continue;

    const modelSteps = allSteps.filter((s) => s.modelId === modelId);
    const completedSteps = modelSteps.filter((s) => s.completed).length;
    const modelInspections = allInspections.filter((q) => q.modelId === modelId);
    const modelReworks = getReworkRecordsByModelId(modelId);
    const qs = domainGetQualityStatus(model, modelSteps, modelInspections, modelReworks);

    lines.push(`【模型编号】${model.modelNo}`);
    lines.push(`  患者姓名: ${model.patientName}`);
    lines.push(`  义齿类型: ${DENTURE_TYPE_LABEL[model.dentureType]}`);
    lines.push(`  流转状态: ${FLOW_STATUS_LABEL[model.status]}`);
    lines.push(`  质检状态: ${QUALITY_STATUS_LABEL[qs] || '-'}`);
    lines.push(`  负责人: ${model.responsiblePerson}`);
    lines.push(`  取模日期: ${formatDate(model.impressionDate)}`);
    lines.push(`  预计交付: ${formatDate(model.expectedDeliveryDate)}`);
    lines.push(`  制作进度: ${completedSteps}/${modelSteps.length} 步骤`);
    const latestInspection = domainGetLatestInspection(modelInspections);
    if (latestInspection) {
      lines.push(`  最近质检: ${latestInspection.result === 'PASS' ? '通过' : '不通过'} (${formatDate(latestInspection.inspectionDate)} · ${latestInspection.inspector})`);
    }
    if (model.delayReason) {
      lines.push(`  延期原因: ${model.delayReason}`);
    }
    lines.push('');
    lines.push('-'.repeat(80));
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadSummary(text: string, filename?: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `模型摘要_${todayStr()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const thisWeekBatchOperationCount = derived(
  [batchOperations],
  ([$batchOperations]) => getThisWeekBatchOperationCount($batchOperations)
);

export const thisWeekBatchModifiedModelCount = derived(
  [batchOperations],
  ([$batchOperations]) => getThisWeekBatchModifiedModelCount($batchOperations)
);

export const mostUsedBatchActionType = derived(
  [batchOperations],
  ([$batchOperations]) => getMostUsedBatchActionType($batchOperations)
);
