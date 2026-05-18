export const ROUTE_SHORTCUTS = {
  1: '/',
  2: '/habits',
  3: '/analytics',
  4: '/notes',
  5: '/settings'
};

export function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    target.closest?.('[contenteditable="true"]')
  );
}

export function isSearchShortcut(event) {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
}

export function getRouteForNumberShortcut(event) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null;
  return ROUTE_SHORTCUTS[event.key] || null;
}

export function focusGlobalSearch() {
  const input = document.getElementById('global-search');
  if (!input) return false;
  input.focus();
  input.select?.();
  return true;
}
