import type { BatchActionType, FlowStatus, ReminderDays } from '../types';
import { isValidName } from '../validators';
import { isDateBeforeOrEqual } from '../formatters';
import { canTransitionTo } from './statusRules';
import { canMarkReminded, canReschedule } from './deliveryRules';
import type { BatchValidationContext, RuleCheckResult } from './types';

export function validateBatchAction(
  actionType: BatchActionType,
  payload: Record<string, any>,
  ctx: BatchValidationContext
): RuleCheckResult {
  const { model, steps, inspections } = ctx;

  switch (actionType) {
    case 'SET_RESPONSIBLE_PERSON': {
      const person = payload.responsiblePerson as string;
      if (!person || !person.trim()) {
        return { valid: false, message: '负责人不能为空' };
      }
      if (!isValidName(person)) {
        return { valid: false, message: '负责人只能包含中文、英文、数字和空格' };
      }
      return { valid: true };
    }

    case 'SET_EXPECTED_DELIVERY_DATE': {
      const newDate = payload.expectedDeliveryDate as string;
      if (!newDate) {
        return { valid: false, message: '请选择预计交付日期' };
      }
      if (!isDateBeforeOrEqual(model.impressionDate, newDate)) {
        return { valid: false, message: '预计交付日期不能早于取模日期' };
      }
      const rescheduleCheck = canReschedule(model);
      if (!rescheduleCheck.valid) {
        return rescheduleCheck;
      }
      return { valid: true };
    }

    case 'SET_REMINDER_DAYS': {
      const days = payload.reminderDays as number;
      if (days !== 1 && days !== 3 && days !== 7) {
        return { valid: false, message: '提醒天数只能是 1、3 或 7 天' };
      }
      return { valid: true };
    }

    case 'MARK_REMINDED': {
      return canMarkReminded(model);
    }

    case 'SET_FLOW_STATUS': {
      const target = payload.status as FlowStatus;
      if (!target) {
        return { valid: false, message: '请选择目标流转状态' };
      }
      return canTransitionTo(model.status, target, steps, inspections);
    }

    case 'EXPORT_SUMMARY': {
      return { valid: true };
    }

    default:
      return { valid: false, message: '未知的批量操作类型' };
  }
}

export function getActionFieldName(actionType: BatchActionType): string {
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

export function getActionNewValue(
  actionType: BatchActionType,
  payload: Record<string, any>
): string | number | boolean | null {
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

export function canBatchSetStatus(
  targetStatus: FlowStatus,
  ctx: BatchValidationContext
): RuleCheckResult {
  return canTransitionTo(ctx.model.status, targetStatus, ctx.steps, ctx.inspections);
}
