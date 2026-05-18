import { useEffect, useRef } from 'react';
import { checkReminders, getNotificationStatus, getPermission } from '../services/notificationService';

export function useNotifications(state, { onStatusChange, onPermissionDenied } = {}) {
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
    onStatusChange?.(getNotificationStatus(state.settings));
  }, [state, onStatusChange]);

  useEffect(() => {
    let cancelled = false;
    let interval = null;

    const runCheck = async () => {
      const current = stateRef.current;
      const status = getNotificationStatus(current.settings);
      onStatusChange?.(status);

      if (current.settings?.notifications && status.state === 'blocked') {
        onPermissionDenied?.();
      }
      if (!current.settings?.notifications || status.state !== 'granted') return;

      await checkReminders(current);
    };

    runCheck();
    interval = window.setInterval(() => {
      if (!cancelled) runCheck();
    }, 60000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') runCheck();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [onPermissionDenied, onStatusChange]);

  useEffect(() => {
    if (!navigator.permissions?.query || !('Notification' in window)) return undefined;
    let permissionStatus = null;
    let active = true;

    navigator.permissions.query({ name: 'notifications' }).then((status) => {
      if (!active) return;
      permissionStatus = status;
      const handleChange = () => {
        onStatusChange?.(getNotificationStatus(stateRef.current.settings));
      };
      permissionStatus.addEventListener?.('change', handleChange);
      permissionStatus.onchange = handleChange;
    }).catch(() => {
      onStatusChange?.(getNotificationStatus(stateRef.current.settings));
    });

    return () => {
      active = false;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [onStatusChange]);

  useEffect(() => {
    if (getPermission() === 'denied') onPermissionDenied?.();
  }, [onPermissionDenied]);
}
