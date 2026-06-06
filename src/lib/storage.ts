import type { StorageData } from './types';

const STORAGE_KEY = 'denture_models_v1';

export function loadFromStorage(): StorageData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StorageData;
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
