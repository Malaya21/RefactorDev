/**
 * Utility Layer: safe text, attributes, and class names.
 * Rendering code should use these helpers whenever untrusted data reaches the DOM.
 */
const Security = (() => {
  function escapeHTML(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(value = '') {
    return escapeHTML(value).replace(/`/g, '&#96;');
  }

  function sanitizeClassName(value = 'safe') {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'safe';
  }

  function safeRenderText(el, value = '') {
    if (el) el.textContent = value ?? '';
  }

  return { escapeHTML, escapeAttribute, sanitizeClassName, safeRenderText };
})();
