import type { Model, Step, ValidationResult, FlowStatus, QualityInspection } from './types';
import { isDateNotAfterToday, isDateBeforeOrEqual } from './formatters';

const VALID_NAME_PATTERN = /^[\u4e00-\u9fa5a-zA-Z0-9·\s]+$/;

export function isValidName(value: string): boolean {
  if (!value || !value.trim()) return false;
  return VALID_NAME_PATTERN.test(value.trim());
}

export function validateModel(
  model: Partial<Model>,
  existingModels: Model[],
  steps: Step[] = [],
  editingId?: string,
  inspections: QualityInspection[] = []
): ValidationResult {
  const errors: Record<string, string> = {};

  const modelNoVal = model.modelNo?.trim() || '';
  if (!modelNoVal) {
    errors.modelNo = '模型编号不能为空';
  } else {
    const duplicate = existingModels.find(
      (m) => m.modelNo === modelNoVal && m.id !== editingId
    );
    if (duplicate) {
      errors.modelNo = '模型编号已存在，不能重复';
    }
  }

  if (!model.patientName || !model.patientName.trim()) {
    errors.patientName = '患者姓名不能为空';
  } else if (model.patientName.trim().length > 50) {
    errors.patientName = '患者姓名不能超过50个字符';
  } else if (!isValidName(model.patientName)) {
    errors.patientName = '患者姓名只能包含中文、英文、数字和空格';
  }

  if (!model.dentureType) {
    errors.dentureType = '请选择义齿类型';
  }

  if (!model.impressionDate) {
    errors.impressionDate = '请选择取模日期';
  } else if (!isDateNotAfterToday(model.impressionDate)) {
    errors.impressionDate = '取模日期不能晚于当前日期';
  }

  if (!model.expectedDeliveryDate) {
    errors.expectedDeliveryDate = '请选择预计交付日期';
  } else if (
    model.impressionDate &&
    !isDateBeforeOrEqual(model.impressionDate, model.expectedDeliveryDate)
  ) {
    errors.expectedDeliveryDate = '预计交付日期不能早于取模日期';
  }

  if (!model.responsiblePerson || !model.responsiblePerson.trim()) {
    errors.responsiblePerson = '请填写负责人';
  } else if (!isValidName(model.responsiblePerson)) {
    errors.responsiblePerson = '负责人只能包含中文、英文、数字和空格';
  }

  if (!model.status) {
    errors.status = '请选择流转状态';
  } else if (model.status === 'DELIVERED') {
    const deliverCheck = canMarkDelivered(steps, inspections);
    if (!deliverCheck.valid) {
      errors.status = deliverCheck.message || '所有步骤完成且质检通过后才能标记为已交付';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateStep(
  step: Partial<Step>,
  expectedDeliveryDate?: string
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!step.name || !step.name.trim()) {
    errors.name = '步骤名称不能为空';
  }

  if (!step.plannedDate) {
    errors.plannedDate = '请选择计划完成日期';
  } else if (expectedDeliveryDate && !isDateBeforeOrEqual(step.plannedDate, expectedDeliveryDate)) {
    errors.plannedDate = '计划完成日期不能晚于模型预计交付日期';
  }

  if (!step.responsiblePerson || !step.responsiblePerson.trim()) {
    errors.responsiblePerson = '请填写负责人';
  } else if (!isValidName(step.responsiblePerson)) {
    errors.responsiblePerson = '负责人只能包含中文、英文、数字和空格';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function canMarkDelivered(
  steps: Step[],
  inspections?: QualityInspection[]
): { valid: boolean; message?: string } {
  if (!steps || steps.length === 0) {
    return { valid: false, message: '请先添加制作步骤，所有步骤完成后才能标记为已交付' };
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

export function canTransitionTo(
  current: FlowStatus,
  target: FlowStatus,
  steps: Step[],
  inspections?: QualityInspection[]
): { valid: boolean; message?: string } {
  if (target === 'DELIVERED') {
    return canMarkDelivered(steps, inspections);
  }
  return { valid: true };
}

export function validateQualityInspection(data: Partial<QualityInspection>): ValidationResult {
  const errors: Record<string, string> = {};
  if (!data.inspector || !data.inspector.trim()) {
    errors.inspector = '请填写质检人';
  } else if (!isValidName(data.inspector)) {
    errors.inspector = '质检人只能包含中文、英文、数字和空格';
  }
  if (!data.inspectionDate) {
    errors.inspectionDate = '请选择质检日期';
  } else if (!isDateNotAfterToday(data.inspectionDate)) {
    errors.inspectionDate = '质检日期不能晚于当前日期';
  }
  if (!data.result) {
    errors.result = '请选择质检结果';
  }
  if (data.result === 'FAIL') {
    if (!data.problemDescription || !data.problemDescription.trim()) {
      errors.problemDescription = '质检不通过时请填写问题描述';
    }
    if (!data.reworkRequirements || !data.reworkRequirements.trim()) {
      errors.reworkRequirements = '质检不通过时请填写返工要求';
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
