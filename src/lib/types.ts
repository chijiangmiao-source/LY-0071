export type FlowStatus = 'PENDING' | 'IN_PROGRESS' | 'TRIAL' | 'DELIVERED' | 'CANCELLED';

export type DentureType = 'FULL_DENTURE' | 'PARTIAL_DENTURE' | 'CROWN' | 'BRIDGE' | 'IMPLANT' | 'ORTHODONTIC';

export type ReminderDays = 1 | 3 | 7;

export type InspectionResult = 'PASS' | 'FAIL';

export type QualityStatus = 'PENDING' | 'FAILED' | 'PASSED_PENDING_DELIVERY' | 'NONE';

export interface QualityInspection {
  id: string;
  modelId: string;
  inspector: string;
  inspectionDate: string;
  result: InspectionResult;
  problemDescription?: string;
  reworkRequirements?: string;
  handlingRemarks?: string;
  createdAt: string;
}

export interface DeliveryDateHistory {
  id: string;
  previousDate: string;
  newDate: string;
  reason: string;
  changedAt: string;
  changedBy: string;
}

export interface ReminderLog {
  id: string;
  modelId: string;
  remindedAt: string;
  type: 'UPCOMING' | 'OVERDUE';
  note?: string;
}

export interface Model {
  id: string;
  modelNo: string;
  patientName: string;
  dentureType: DentureType;
  impressionDate: string;
  expectedDeliveryDate: string;
  responsiblePerson: string;
  status: FlowStatus;
  createdAt: string;
  updatedAt: string;
  reminderDays?: ReminderDays;
  reminded: boolean;
  remindedAt?: string;
  delayReason?: string;
  deliveryDateHistory: DeliveryDateHistory[];
}

export interface Step {
  id: string;
  modelId: string;
  name: string;
  responsiblePerson: string;
  plannedDate: string;
  completed: boolean;
  completedAt?: string;
  remark?: string;
}

export interface StorageData {
  models: Model[];
  steps: Step[];
  reminderLogs: ReminderLog[];
  qualityInspections: QualityInspection[];
  updatedAt: string;
}

export const INSPECTION_RESULT_LABEL: Record<InspectionResult, string> = {
  PASS: '通过',
  FAIL: '不通过'
};

export const QUALITY_STATUS_LABEL: Record<QualityStatus, string> = {
  PENDING: '待质检',
  FAILED: '质检未通过',
  PASSED_PENDING_DELIVERY: '质检通过待交付',
  NONE: ''
};

export const QUALITY_STATUS_COLOR: Record<QualityStatus, string> = {
  PENDING: 'bg-orange-100 text-orange-700 border-orange-300',
  FAILED: 'bg-red-100 text-red-700 border-red-300',
  PASSED_PENDING_DELIVERY: 'bg-teal-100 text-teal-700 border-teal-300',
  NONE: ''
};

export const QUALITY_STATUS_DOT_COLOR: Record<QualityStatus, string> = {
  PENDING: 'bg-orange-500',
  FAILED: 'bg-red-500',
  PASSED_PENDING_DELIVERY: 'bg-teal-500',
  NONE: ''
};

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export const FLOW_STATUS_LABEL: Record<FlowStatus, string> = {
  PENDING: '待制作',
  IN_PROGRESS: '制作中',
  TRIAL: '待试戴',
  DELIVERED: '已交付',
  CANCELLED: '已取消'
};

export const FLOW_STATUS_COLOR: Record<FlowStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700 border-slate-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-300',
  TRIAL: 'bg-amber-100 text-amber-700 border-amber-300',
  DELIVERED: 'bg-green-100 text-green-700 border-green-300',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-300'
};

export const DENTURE_TYPE_LABEL: Record<DentureType, string> = {
  FULL_DENTURE: '全口义齿',
  PARTIAL_DENTURE: '局部义齿',
  CROWN: '单冠',
  BRIDGE: '固定桥',
  IMPLANT: '种植修复',
  ORTHODONTIC: '正畸矫治器'
};

export const DEFAULT_STEP_NAMES = [
  '模型检查与设计',
  '蜡型制作',
  '包埋铸造',
  '打磨抛光',
  '上瓷/排牙',
  '最终质检'
];

export const REMINDER_DAYS_OPTIONS: { value: ReminderDays; label: string }[] = [
  { value: 1, label: '提前 1 天' },
  { value: 3, label: '提前 3 天' },
  { value: 7, label: '提前 7 天' }
];

export const DEFAULT_REMINDER_DAYS: ReminderDays = 3;
