import { sanitizeString } from './security';
import { todayKey } from './date';

export const VALID_THEMES = ['dark', 'light', 'system'];
export const VALID_LAYOUTS = ['default', 'compact', 'wide'];
export const VALID_FREQUENCIES = ['daily', 'weekly', 'custom'];
export const VALID_STATUSES = ['completed', 'missed'];
export const VALID_MOODS = ['great', 'good', 'neutral', 'low', 'bad'];

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function toBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

export function toNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeDateKey(value, fallback = todayKey()) {
  const clean = sanitizeString(value, fallback, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean) && !Number.isNaN(new Date(`${clean}T12:00:00`).getTime())) {
    return clean;
  }
  return fallback;
}

export function sanitizeIsoDate(value, fallback = new Date().toISOString()) {
  const clean = sanitizeString(value, '', 40);
  if (!clean) return fallback;
  const d = new Date(clean);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

export function sanitizeEnum(value, allowed, fallback) {
  const clean = sanitizeString(value, fallback, 40);
  return allowed.includes(clean) ? clean : fallback;
}

export function validateCustomDays(value, frequency) {
  const fallback = frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  if (!Array.isArray(value)) return fallback;
  const days = [...new Set(value.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  return days.length ? days.sort((a, b) => a - b) : fallback;
}

export function validateHistory(value) {
  if (!isPlainObject(value)) return {};
  return Object.entries(value).reduce((out, [key, val]) => {
    const safeKey = sanitizeDateKey(key, null);
    const status = sanitizeEnum(val, VALID_STATUSES, '');
    if (safeKey && status) out[safeKey] = status;
    return out;
  }, {});
}

export function sanitizeStringMap(value, maxValueLength = 800) {
  if (!isPlainObject(value)) return {};
  return Object.entries(value).reduce((out, [key, val]) => {
    const safeKey = sanitizeDateKey(key, null);
    if (safeKey) out[safeKey] = sanitizeString(val, '', maxValueLength);
    return out;
  }, {});
}
