import type { Model, Step, QualityInspection, ReworkRecord, QualityStatus } from '../types';
import { areAllStepsCompleted } from './statusRules';
import type { QualityStatusInfo } from './types';

export function getLatestInspection(
  inspections: QualityInspection[]
): QualityInspection | undefined {
  if (!inspections || inspections.length === 0) return undefined;
  const sorted = [...inspections].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return sorted[0];
}

export function hasActiveRework(reworkRecords: ReworkRecord[]): boolean {
  return reworkRecords.some((r) => r.status === 'IN_PROGRESS');
}

export function getActiveRework(
  reworkRecords: ReworkRecord[]
): ReworkRecord | undefined {
  return reworkRecords.find((r) => r.status === 'IN_PROGRESS');
}

export function needsQualityInspection(
  model: Model,
  steps: Step[]
): boolean {
  if (model.status === 'CANCELLED' || model.status === 'DELIVERED') return false;
  const stepsCompleted = areAllStepsCompleted(steps);
  return stepsCompleted || model.status === 'TRIAL';
}

export function hasPassedLatestInspection(
  inspections: QualityInspection[]
): boolean {
  const latest = getLatestInspection(inspections);
  return latest?.result === 'PASS';
}

export function getQualityStatus(
  model: Model,
  steps: Step[],
  inspections: QualityInspection[],
  reworkRecords: ReworkRecord[]
): QualityStatus {
  if (model.status === 'CANCELLED' || model.status === 'DELIVERED') return 'NONE';
  const needsInspection = needsQualityInspection(model, steps);
  if (hasActiveRework(reworkRecords)) {
    return 'PENDING';
  }
  const latest = getLatestInspection(inspections);
  if (!latest) {
    return needsInspection ? 'PENDING' : 'NONE';
  }
  return latest.result === 'PASS' ? 'PASSED_PENDING_DELIVERY' : 'FAILED';
}

export function getQualityStatusInfo(
  model: Model,
  steps: Step[],
  inspections: QualityInspection[],
  reworkRecords: ReworkRecord[]
): QualityStatusInfo {
  const status = getQualityStatus(model, steps, inspections, reworkRecords);
  const latest = getLatestInspection(inspections);
  return {
    status,
    needsInspection: needsQualityInspection(model, steps),
    hasActiveRework: hasActiveRework(reworkRecords),
    latestPassed: latest?.result === 'PASS'
  };
}

export function getReworkCount(inspections: QualityInspection[]): number {
  return inspections.filter((q) => q.result === 'FAIL').length;
}

export function canStartRework(
  model: Model,
  inspections: QualityInspection[],
  reworkRecords: ReworkRecord[]
): { valid: boolean; message?: string } {
  if (model.status === 'CANCELLED' || model.status === 'DELIVERED') {
    return { valid: false, message: '已取消或已交付的模型不能发起返工' };
  }
  if (hasActiveRework(reworkRecords)) {
    return { valid: false, message: '当前存在进行中的返工，请先完成后再发起新的返工' };
  }
  const latest = getLatestInspection(inspections);
  if (!latest) {
    return { valid: false, message: '请先完成质检记录，质检不通过后才能发起返工' };
  }
  if (latest.result !== 'FAIL') {
    return { valid: false, message: '最近一次质检已通过，无需返工' };
  }
  return { valid: true };
}

export function canCompleteRework(
  reworkRecord: ReworkRecord | undefined
): { valid: boolean; message?: string } {
  if (!reworkRecord) {
    return { valid: false, message: '没有进行中的返工记录' };
  }
  if (reworkRecord.status !== 'IN_PROGRESS') {
    return { valid: false, message: '该返工记录已完成' };
  }
  return { valid: true };
}
