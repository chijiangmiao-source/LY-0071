import type { Model, FlowStatus, ReminderDays } from '../types';
import { DEFAULT_REMINDER_DAYS } from '../types';
import type { DeliveryStatusInfo } from './types';
import { todayStr, daysRemaining } from '../formatters';

export function isOverdue(expectedDate: string, status: FlowStatus): boolean {
  if (!expectedDate || status === 'DELIVERED' || status === 'CANCELLED') return false;
  const today = new Date(todayStr());
  const expected = new Date(expectedDate);
  return expected < today;
}

export function getDeliveryStatus(
  expectedDate: string,
  status: FlowStatus,
  reminderDays: ReminderDays = DEFAULT_REMINDER_DAYS
): 'NORMAL' | 'UPCOMING' | 'OVERDUE' {
  if (!expectedDate || status === 'DELIVERED' || status === 'CANCELLED') return 'NORMAL';
  const remaining = daysRemaining(expectedDate);
  if (remaining < 0) return 'OVERDUE';
  if (remaining <= reminderDays) return 'UPCOMING';
  return 'NORMAL';
}

export function getDeliveryStatusInfo(
  model: Model
): DeliveryStatusInfo {
  const status = getDeliveryStatus(
    model.expectedDeliveryDate,
    model.status,
    model.reminderDays ?? DEFAULT_REMINDER_DAYS
  );
  const remaining = daysRemaining(model.expectedDeliveryDate);
  return {
    status,
    remainingDays: remaining,
    isOverdue: status === 'OVERDUE',
    isUpcoming: status === 'UPCOMING'
  };
}

export function isUpcoming(
  expectedDate: string,
  status: FlowStatus,
  reminderDays: ReminderDays = DEFAULT_REMINDER_DAYS
): boolean {
  return getDeliveryStatus(expectedDate, status, reminderDays) === 'UPCOMING';
}

export function shouldShowAlert(model: Model): boolean {
  const info = getDeliveryStatusInfo(model);
  return info.isOverdue || info.isUpcoming;
}

export function canMarkReminded(model: Model): { valid: boolean; message?: string } {
  if (model.status === 'DELIVERED' || model.status === 'CANCELLED') {
    return { valid: false, message: '已交付或已取消的模型无需标记提醒' };
  }
  if (model.reminded) {
    return { valid: false, message: '该模型已标记为已提醒' };
  }
  return { valid: true };
}

export function canReschedule(model: Model): { valid: boolean; message?: string } {
  if (model.status === 'DELIVERED' || model.status === 'CANCELLED') {
    return { valid: false, message: '已交付或已取消的模型不能修改预计交付日期' };
  }
  return { valid: true };
}

export function isModelActive(model: Model): boolean {
  return model.status !== 'DELIVERED' && model.status !== 'CANCELLED';
}
