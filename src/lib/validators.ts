import type { Model, Step, ValidationResult, FlowStatus } from './types';
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
  editingId?: string
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!model.modelNo || !model.modelNo.trim()) {
    errors.modelNo = '模型编号不能为空';
  } else {
    const duplicate = existingModels.find(
      (m) => m.modelNo === model.modelNo.trim() && m.id !== editingId
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
    const deliverCheck = canMarkDelivered(steps);
    if (!deliverCheck.valid) {
      errors.status = deliverCheck.message || '所有步骤完成后才能标记为已交付';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateStep(step: Partial<Step>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!step.name || !step.name.trim()) {
    errors.name = '步骤名称不能为空';
  }

  if (!step.plannedDate) {
    errors.plannedDate = '请选择计划完成日期';
  }

  if (!step.responsiblePerson || !step.responsiblePerson.trim()) {
    errors.responsiblePerson = '请填写负责人';
  } else if (!isValidName(step.responsiblePerson)) {
    errors.responsiblePerson = '负责人只能包含中文、英文、数字和空格';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function canMarkDelivered(steps: Step[]): { valid: boolean; message?: string } {
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
  return { valid: true };
}

export function canTransitionTo(current: FlowStatus, target: FlowStatus, steps: Step[]): { valid: boolean; message?: string } {
  if (target === 'DELIVERED') {
    return canMarkDelivered(steps);
  }
  return { valid: true };
}
