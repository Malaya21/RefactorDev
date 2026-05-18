export function escapeHTML(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttribute(value = '') {
  return escapeHTML(value).replace(/`/g, '&#96;');
}

export function sanitizeClassName(value = 'safe') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'safe';
}

export function sanitizeString(value, fallback = '', maxLength = 240) {
  if (value === undefined || value === null) return fallback;
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\son[a-z]+\s*=/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}
