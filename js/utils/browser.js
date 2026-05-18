/**
 * Utility Layer: browser APIs with compatibility/error handling.
 */
const BrowserUtils = (() => {
  function safeDownloadFile(name, content, type, { onSuccess, onError } = {}) {
    let objectUrl = '';
    const a = document.createElement('a');

    try {
      const blob = new Blob([content], { type });
      objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = name;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      if (onSuccess) onSuccess(name);
      return true;
    } catch (err) {
      console.warn('ReflectFlow export failed:', { name, type, error: err });
      if (onError) onError(err);
      return false;
    } finally {
      a.remove();
      if (objectUrl) {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(objectUrl);
          } catch (err) {
            console.warn('ReflectFlow could not revoke export URL:', err);
          }
        }, 1000);
      }
    }
  }

  function safeOpenPrintWindow(html, title = 'ReflectFlow Report', { onBlocked, onError } = {}) {
    let win = null;

    try {
      win = window.open('', '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.warn('ReflectFlow could not open print window:', err);
    }

    if (!win || win.closed || typeof win.closed === 'undefined') {
      console.warn('ReflectFlow print popup was blocked or unavailable.', { title });
      if (onBlocked) onBlocked();
      return false;
    }

    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        try {
          win.print();
        } catch (err) {
          console.warn('ReflectFlow print command failed:', err);
          if (onError) onError(err);
        }
      }, 250);
      return true;
    } catch (err) {
      console.warn('ReflectFlow could not write print report:', err);
      if (onError) onError(err);
      try {
        win.close();
      } catch (_) {}
      return false;
    }
  }

  return { safeDownloadFile, safeOpenPrintWindow };
})();
