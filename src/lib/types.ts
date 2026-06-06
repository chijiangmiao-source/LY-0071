export type FlowStatus = 'PENDING' | 'IN_PROGRESS' | 'TRIAL' | 'DELIVERED' | 'CANCELLED';

export type DentureType = 'FULL_DENTURE' | 'PARTIAL_DENTURE' | 'CROWN' | 'BRIDGE' | 'IMPLANT' | 'ORTHODONTIC';

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
  updatedAt: string;
}

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
