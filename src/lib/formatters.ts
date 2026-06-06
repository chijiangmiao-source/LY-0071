export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isOverdue(expectedDate: string, status: string): boolean {
  if (!expectedDate || status === 'DELIVERED' || status === 'CANCELLED') return false;
  const today = new Date(todayStr());
  const expected = new Date(expectedDate);
  return expected < today;
}

export function daysRemaining(expectedDate: string): number {
  if (!expectedDate) return 0;
  const today = new Date(todayStr());
  const expected = new Date(expectedDate);
  const diff = Math.floor((expected.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function isDateBeforeOrEqual(date1: string, date2: string): boolean {
  if (!date1 || !date2) return true;
  return new Date(date1) <= new Date(date2);
}

export function isDateNotAfterToday(dateStr: string): boolean {
  if (!dateStr) return true;
  return isDateBeforeOrEqual(dateStr, todayStr());
}

export function getLastNDates(n: number): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export type DeliveryStatus = 'NORMAL' | 'UPCOMING' | 'OVERDUE';

export function getDeliveryStatus(
  expectedDate: string,
  status: string,
  reminderDays: number = 3
): DeliveryStatus {
  if (!expectedDate || status === 'DELIVERED' || status === 'CANCELLED') return 'NORMAL';
  const remaining = daysRemaining(expectedDate);
  if (remaining < 0) return 'OVERDUE';
  if (remaining <= reminderDays) return 'UPCOMING';
  return 'NORMAL';
}

export function isUpcoming(
  expectedDate: string,
  status: string,
  reminderDays: number = 3
): boolean {
  return getDeliveryStatus(expectedDate, status, reminderDays) === 'UPCOMING';
}
