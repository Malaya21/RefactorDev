/**
 * sidebar.js — Mobile drawer: open/close, overlay, keyboard, resize
 */
const Sidebar = (() => {
  const MQ = '(max-width: 992px)';
  let mediaQuery = null;
  let abort = null;
  let isOpen = false;
  let onNavigate = null;

  const els = () => ({
    sidebar: document.getElementById('sidebar'),
    overlay: document.getElementById('sidebar-overlay'),
    toggle: document.getElementById('menu-toggle'),
    nav: document.getElementById('sidebar-nav')
  });

  function isMobile() {
    return mediaQuery?.matches ?? window.innerWidth <= 992;
  }

  function lockScroll(lock) {
    document.body.classList.toggle('sidebar-open', lock);
    document.documentElement.classList.toggle('sidebar-open', lock);
  }

  function syncToggleButton(open) {
    const { toggle } = els();
    if (!toggle) return;
    toggle.textContent = open ? '✕' : '☰';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  function close() {
    const { sidebar, overlay } = els();
    if (!sidebar) return;

    isOpen = false;
    sidebar.classList.remove('open');
    sidebar.setAttribute('aria-hidden', isMobile() ? 'true' : 'false');
    if (isMobile()) sidebar.setAttribute('inert', '');
    overlay?.classList.remove('active');
    overlay?.setAttribute('aria-hidden', 'true');
    lockScroll(false);
    syncToggleButton(false);
  }

  function open() {
    const { sidebar, overlay } = els();
    if (!sidebar || !isMobile()) return;

    isOpen = true;
    sidebar.classList.add('open');
    sidebar.removeAttribute('inert');
    sidebar.setAttribute('aria-hidden', 'false');
    overlay?.classList.add('active');
    overlay?.setAttribute('aria-hidden', 'false');
    lockScroll(true);
    syncToggleButton(true);
  }

  function toggleDrawer() {
    if (isOpen) close();
    else open();
  }

  function handleNav(section) {
    close();
    if (onNavigate && section) onNavigate(section);
  }

  function onDocumentClick(e) {
    if (!isMobile() || !isOpen) return;
    const { sidebar, toggle } = els();
    if (sidebar?.contains(e.target) || toggle?.contains(e.target)) return;
    close();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      close();
    }
  }

  function onResize() {
    if (!isMobile()) close();
  }

  function onHashChange() {
    close();
  }

  function destroy() {
    abort?.abort();
    abort = null;
    close();
    mediaQuery?.removeEventListener('change', onResize);
    mediaQuery = null;
  }

  function init(options = {}) {
    destroy();
    onNavigate = options.onNavigate || null;
    mediaQuery = window.matchMedia(MQ);
    abort = new AbortController();
    const { signal } = abort;
    const { toggle, overlay, nav } = els();

    close();

    toggle?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleDrawer();
      },
      { signal }
    );

    overlay?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        close();
      },
      { signal }
    );

    nav?.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest('.nav-link[data-section]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        handleNav(btn.dataset.section);
      },
      { signal }
    );

    document.addEventListener('click', onDocumentClick, { signal, capture: true });
    document.addEventListener('keydown', onKeyDown, { signal });
    window.addEventListener('hashchange', onHashChange, { signal });
    mediaQuery.addEventListener('change', onResize, { signal });

    return { open, close, toggle: toggleDrawer, isMobile, destroy };
  }

  return { init, open, close, toggle: toggleDrawer, isMobile, destroy };
})();
