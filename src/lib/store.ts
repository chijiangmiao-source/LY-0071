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
import { generateId, todayStr, daysRemaining, getDeliveryStatus, formatDate } from './formatters';
import { validateBatchAction, canTransitionTo, canMarkDelivered } from './validators';

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
  const activeRework = getActiveRework(model.id);
  if (activeRework) {
    return 'PENDING';
  }
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
  return get(reworkRecords).find(
    (r) => r.modelId === modelId && r.status === 'IN_PROGRESS'
  );
}

export const activeReworkCount = derived(
  [reworkRecords],
  ([$reworkRecords]) => $reworkRecords.filter((r) => r.status === 'IN_PROGRESS').length
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

    const check = validateBatchAction(actionType, payload, {
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
          const transCheck = canTransitionTo(model.status, targetStatus, modelSteps, modelInspections);
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
          field: getActionFieldName(actionType),
          previousValue: previousValues[Object.keys(previousValues)[0]] ?? null,
          newValue: getActionNewValue(actionType, payload)
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

function getActionFieldName(actionType: BatchActionType): string {
  switch (actionType) {
    case 'SET_RESPONSIBLE_PERSON': return '负责人';
    case 'SET_EXPECTED_DELIVERY_DATE': return '预计交付日期';
    case 'SET_REMINDER_DAYS': return '提醒天数';
    case 'MARK_REMINDED': return '提醒状态';
    case 'SET_FLOW_STATUS': return '流转状态';
    case 'EXPORT_SUMMARY': return '导出摘要';
    default: return '';
  }
}

function getActionNewValue(actionType: BatchActionType, payload: Record<string, any>): string | number | boolean | null {
  switch (actionType) {
    case 'SET_RESPONSIBLE_PERSON': return payload.responsiblePerson ?? null;
    case 'SET_EXPECTED_DELIVERY_DATE': return payload.expectedDeliveryDate ?? null;
    case 'SET_REMINDER_DAYS': return payload.reminderDays ?? null;
    case 'MARK_REMINDED': return true;
    case 'SET_FLOW_STATUS': return payload.status ?? null;
    case 'EXPORT_SUMMARY': return null;
    default: return null;
  }
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
    const latestInspection = modelInspections.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const qs = getQualityStatus(model);

    lines.push(`【模型编号】${model.modelNo}`);
    lines.push(`  患者姓名: ${model.patientName}`);
    lines.push(`  义齿类型: ${DENTURE_TYPE_LABEL[model.dentureType]}`);
    lines.push(`  流转状态: ${FLOW_STATUS_LABEL[model.status]}`);
    lines.push(`  质检状态: ${QUALITY_STATUS_LABEL[qs] || '-'}`);
    lines.push(`  负责人: ${model.responsiblePerson}`);
    lines.push(`  取模日期: ${formatDate(model.impressionDate)}`);
    lines.push(`  预计交付: ${formatDate(model.expectedDeliveryDate)}`);
    lines.push(`  制作进度: ${completedSteps}/${modelSteps.length} 步骤`);
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
  ([$batchOperations]) => {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    return $batchOperations.filter((op) => new Date(op.createdAt) >= monday).length;
  }
);

export const thisWeekBatchModifiedModelCount = derived(
  [batchOperations],
  ([$batchOperations]) => {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    const modelSet = new Set<string>();
    for (const op of $batchOperations) {
      if (new Date(op.createdAt) >= monday && op.actionType !== 'EXPORT_SUMMARY') {
        for (const id of op.succeededIds) modelSet.add(id);
      }
    }
    return modelSet.size;
  }
);

export const mostUsedBatchActionType = derived(
  [batchOperations],
  ([$batchOperations]): { type: BatchActionType | null; label: string; count: number } => {
    if ($batchOperations.length === 0) {
      return { type: null, label: '-', count: 0 };
    }
    const counter: Record<string, number> = {};
    for (const op of $batchOperations) {
      counter[op.actionType] = (counter[op.actionType] || 0) + 1;
    }
    let maxType = '';
    let maxCount = 0;
    for (const [t, c] of Object.entries(counter)) {
      if (c > maxCount) {
        maxCount = c;
        maxType = t;
      }
    }
    const type = maxType as BatchActionType;
    return {
      type,
      label: BATCH_ACTION_TYPE_LABEL[type] || '-',
      count: maxCount
    };
  }
);
