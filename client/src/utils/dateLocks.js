import { addDays, compareDateKeys, todayKey } from './date';

export const LOCKED_DATE_MESSAGE = 'Past records older than yesterday are locked.';

export function canEditDate(dateKey, currentKey = todayKey()) {
  if (!dateKey) return false;
  const yesterday = addDays(currentKey, -1);
  return dateKey === currentKey || dateKey === yesterday;
}

export function isLockedDate(dateKey, currentKey = todayKey()) {
  if (!dateKey) return true;
  return compareDateKeys(dateKey, addDays(currentKey, -1)) < 0;
}

export function getEditableDateLabel(dateKey, currentKey = todayKey()) {
  if (dateKey === currentKey) return 'Today';
  if (dateKey === addDays(currentKey, -1)) return 'Yesterday';
  return isLockedDate(dateKey, currentKey) ? 'Locked' : 'Future';
}
