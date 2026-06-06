import type { FlowStatus, Step, QualityInspection } from '../types';
import type { RuleCheckResult } from './types';

export const FINAL_STATUSES: FlowStatus[] = ['DELIVERED', 'CANCELLED'];

export function isFinalStatus(status: FlowStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

export function isActiveStatus(status: FlowStatus): boolean {
  return !isFinalStatus(status);
}

export function canTransitionTo(
  current: FlowStatus,
  target: FlowStatus,
  steps: Step[],
  inspections?: QualityInspection[]
): RuleCheckResult {
  if (target === 'DELIVERED') {
    return canMarkDelivered(steps, inspections);
  }
  return { valid: true };
}

export function canMarkDelivered(
  steps: Step[],
  inspections?: QualityInspection[]
): RuleCheckResult {
  if (!steps || steps.length === 0) {
    return {
      valid: false,
      message: '请先添加制作步骤，所有步骤完成后才能标记为已交付'
    };
  }
  const incomplete = steps.filter((s) => !s.completed);
  if (incomplete.length > 0) {
    return {
      valid: false,
      message: `还有 ${incomplete.length} 个步骤未完成（${incomplete.map((s) => s.name).join('、')}），请先完成所有步骤`
    };
  }
  const sorted = [...(inspections || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const latest = sorted[0];
  if (!latest) {
    return { valid: false, message: '请先完成质检记录，质检通过后才能标记为已交付' };
  }
  if (latest.result !== 'PASS') {
    return { valid: false, message: '最近一次质检未通过，请整改完成并重新质检通过后才能交付' };
  }
  return { valid: true };
}

export function areAllStepsCompleted(steps: Step[]): boolean {
  return steps.length > 0 && steps.every((s) => s.completed);
}
