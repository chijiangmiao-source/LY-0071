import type {
  Model,
  Step,
  QualityInspection,
  ReworkRecord,
  FlowStatus,
  DentureType,
  BatchOperation,
  BatchActionType
} from '../types';
import { DEFAULT_REMINDER_DAYS, BATCH_ACTION_TYPE_LABEL } from '../types';
import { isOverdue, isUpcoming, getDeliveryStatus } from './deliveryRules';
import { getQualityStatus, getLatestInspection, getActiveRework, getReworkCount } from './qualityRules';
import { areAllStepsCompleted } from './statusRules';

export function countModelsByStatus(models: Model[]): Record<FlowStatus, number> {
  const result: Record<FlowStatus, number> = {
    PENDING: 0,
    IN_PROGRESS: 0,
    TRIAL: 0,
    DELIVERED: 0,
    CANCELLED: 0
  };
  for (const m of models) {
    result[m.status]++;
  }
  return result;
}

export function countDentureType(models: Model[]): Partial<Record<DentureType, number>> {
  const result: Partial<Record<DentureType, number>> = {};
  for (const m of models) {
    result[m.dentureType] = (result[m.dentureType] || 0) + 1;
  }
  return result;
}

export function getOverdueModels(models: Model[]): Model[] {
  return models.filter((m) => isOverdue(m.expectedDeliveryDate, m.status));
}

export function getUpcomingModels(models: Model[]): Model[] {
  return models.filter((m) => {
    if (m.status === 'DELIVERED' || m.status === 'CANCELLED') return false;
    return isUpcoming(m.expectedDeliveryDate, m.status, m.reminderDays ?? DEFAULT_REMINDER_DAYS);
  });
}

export function getUpcomingAndOverdueModels(models: Model[]): Model[] {
  return models.filter((m) => {
    const status = getDeliveryStatus(
      m.expectedDeliveryDate,
      m.status,
      m.reminderDays ?? DEFAULT_REMINDER_DAYS
    );
    return status !== 'NORMAL';
  });
}

export function getDelayReasonStats(models: Model[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const m of models) {
    if (m.delayReason && m.delayReason.trim()) {
      const reason = m.delayReason.trim();
      result[reason] = (result[reason] || 0) + 1;
    }
  }
  return result;
}

export function getTotalRescheduleCount(models: Model[]): number {
  let total = 0;
  for (const m of models) {
    total += (m.deliveryDateHistory?.length || 0);
  }
  return total;
}

export function countPendingQualityInspection(
  models: Model[],
  steps: Step[],
  inspections: QualityInspection[],
  reworkRecords: ReworkRecord[]
): number {
  let count = 0;
  for (const m of models) {
    if (m.status === 'DELIVERED' || m.status === 'CANCELLED') continue;
    const modelSteps = steps.filter((s) => s.modelId === m.id);
    const modelInspections = inspections.filter((q) => q.modelId === m.id);
    const modelReworks = reworkRecords.filter((r) => r.modelId === m.id);
    const qs = getQualityStatus(m, modelSteps, modelInspections, modelReworks);
    if (qs === 'PENDING') count++;
  }
  return count;
}

export function getQualityInspectionPassRate(
  models: Model[],
  inspections: QualityInspection[]
): { rate: number; total: number; passed: number } {
  const inspectedModelIds = new Set<string>();
  let passedCount = 0;
  for (const m of models) {
    const modelInspections = inspections.filter((q) => q.modelId === m.id);
    const latest = getLatestInspection(modelInspections);
    if (latest) {
      inspectedModelIds.add(m.id);
      if (latest.result === 'PASS') passedCount++;
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

export function countActiveRework(reworkRecords: ReworkRecord[]): number {
  return reworkRecords.filter((r) => r.status === 'IN_PROGRESS').length;
}

export function countTotalRework(inspections: QualityInspection[]): number {
  return inspections.filter((q) => q.result === 'FAIL').length;
}

export function countQualityFailed(
  models: Model[],
  steps: Step[],
  inspections: QualityInspection[],
  reworkRecords: ReworkRecord[]
): number {
  let count = 0;
  for (const m of models) {
    if (m.status === 'DELIVERED' || m.status === 'CANCELLED') continue;
    const modelSteps = steps.filter((s) => s.modelId === m.id);
    const modelInspections = inspections.filter((q) => q.modelId === m.id);
    const modelReworks = reworkRecords.filter((r) => r.modelId === m.id);
    const qs = getQualityStatus(m, modelSteps, modelInspections, modelReworks);
    if (qs === 'FAILED') count++;
  }
  return count;
}

export function countQualityPassedPendingDelivery(
  models: Model[],
  steps: Step[],
  inspections: QualityInspection[],
  reworkRecords: ReworkRecord[]
): number {
  let count = 0;
  for (const m of models) {
    if (m.status === 'DELIVERED' || m.status === 'CANCELLED') continue;
    const modelSteps = steps.filter((s) => s.modelId === m.id);
    const modelInspections = inspections.filter((q) => q.modelId === m.id);
    const modelReworks = reworkRecords.filter((r) => r.modelId === m.id);
    const qs = getQualityStatus(m, modelSteps, modelInspections, modelReworks);
    if (qs === 'PASSED_PENDING_DELIVERY') count++;
  }
  return count;
}

export function getThisWeekBatchOperationCount(batchOperations: BatchOperation[]): number {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  return batchOperations.filter((op) => new Date(op.createdAt) >= monday).length;
}

export function getThisWeekBatchModifiedModelCount(batchOperations: BatchOperation[]): number {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  const modelSet = new Set<string>();
  for (const op of batchOperations) {
    if (new Date(op.createdAt) >= monday && op.actionType !== 'EXPORT_SUMMARY') {
      for (const id of op.succeededIds) modelSet.add(id);
    }
  }
  return modelSet.size;
}

export function getMostUsedBatchActionType(
  batchOperations: BatchOperation[]
): { type: BatchActionType | null; label: string; count: number } {
  if (batchOperations.length === 0) {
    return { type: null, label: '-', count: 0 };
  }
  const counter: Record<string, number> = {};
  for (const op of batchOperations) {
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
