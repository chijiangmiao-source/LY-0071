export interface RuleCheckResult {
  valid: boolean;
  message?: string;
}

export interface DeliveryStatusInfo {
  status: 'NORMAL' | 'UPCOMING' | 'OVERDUE';
  remainingDays: number;
  isOverdue: boolean;
  isUpcoming: boolean;
}

export interface QualityStatusInfo {
  status: 'PENDING' | 'FAILED' | 'PASSED_PENDING_DELIVERY' | 'NONE';
  needsInspection: boolean;
  hasActiveRework: boolean;
  latestPassed: boolean;
}

export interface BatchValidationContext {
  model: import('../types').Model;
  steps: import('../types').Step[];
  inspections: import('../types').QualityInspection[];
}

export interface QualityInspectionContext {
  stepsCompleted: boolean;
  statusIsTrial: boolean;
  hasActiveRework: boolean;
  latestInspection?: import('../types').QualityInspection;
}
