import type { StorageData, Model } from './types';
import { DEFAULT_REMINDER_DAYS } from './types';

const STORAGE_KEY = 'denture_models_v1';

function migrateModel(model: any): Model {
  return {
    ...model,
    reminderDays: model.reminderDays ?? DEFAULT_REMINDER_DAYS,
    reminded: model.reminded ?? false,
    remindedAt: model.remindedAt,
    delayReason: model.delayReason,
    deliveryDateHistory: model.deliveryDateHistory ?? []
  };
}

export function loadFromStorage(): StorageData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    return {
      models: (parsed.models || []).map(migrateModel),
      steps: parsed.steps || [],
      reminderLogs: parsed.reminderLogs || [],
      qualityInspections: parsed.qualityInspections || [],
      reworkRecords: parsed.reworkRecords || [],
      updatedAt: parsed.updatedAt || new Date().toISOString()
    };
  } catch (e) {
    console.error('Failed to load from storage:', e);
    return null;
  }
}

export function saveToStorage(data: StorageData): void {
  if (typeof window === 'undefined') return;
  try {
    data.updatedAt = new Date().toISOString();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to storage:', e);
  }
}

export function clearStorage(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
