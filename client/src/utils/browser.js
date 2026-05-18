export function safeDownloadFile(name, content, type, { onSuccess, onError } = {}) {
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
    onSuccess?.(name);
    return true;
  } catch (error) {
    console.warn('ReflectFlow export failed:', { name, type, error });
    onError?.(error);
    return false;
  } finally {
    a.remove();
    if (objectUrl) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (error) {
          console.warn('ReflectFlow could not revoke export URL:', error);
        }
      }, 1000);
    }
  }
}

export function safeOpenPrintWindow(html, title = 'ReflectFlow Report', { onBlocked, onError } = {}) {
  let win = null;
  try {
    // Do not pass "noopener" here: Chromium/Edge may return null for noopener popups,
    // which breaks the print flow even when the popup opened successfully.
    win = window.open('', '_blank');
    if (win) win.opener = null;
  } catch (error) {
    console.warn('ReflectFlow could not open print window:', error);
  }

  if (!win || win.closed || typeof win.closed === 'undefined') {
    console.warn('ReflectFlow print popup was blocked or unavailable.', { title });
    onBlocked?.();
    return false;
  }

  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
    if (!win.document.body) {
      throw new Error('Print window document did not render a body.');
    }

    const triggerPrint = () => {
      try {
        win.focus();
        win.print();
      } catch (error) {
        console.warn('ReflectFlow print command failed:', error);
        onError?.(error);
      }
    };

    // Give the new document a paint frame before printing; this keeps Chrome/Edge
    // reliable while still opening the popup synchronously from the click handler.
    if (typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(() => win.setTimeout(triggerPrint, 50));
    } else {
      win.setTimeout(triggerPrint, 100);
    }
    return true;
  } catch (error) {
    console.warn('ReflectFlow could not write print report:', error);
    onError?.(error);
    try {
      win.close();
    } catch (_) {}
    return false;
  }
}
