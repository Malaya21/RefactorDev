import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { focusGlobalSearch, getRouteForNumberShortcut, isEditableTarget, isSearchShortcut } from '../services/keyboardService';
import { useApp } from '../context/AppContext';

function useLatest(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { state, actions } = useApp();
  const latest = useLatest({ state, actions, navigate });

  useEffect(() => {
    const onKeyDown = (event) => {
      const { state: currentState, actions: currentActions, navigate: currentNavigate } = latest.current;

      if (isSearchShortcut(event)) {
        event.preventDefault();
        currentActions.closeTransientUi();
        focusGlobalSearch();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        currentActions.closeTransientUi();
        return;
      }

      if (isEditableTarget(event.target)) return;

      const route = getRouteForNumberShortcut(event);
      if (route) {
        event.preventDefault();
        currentActions.closeTransientUi();
        currentNavigate(route);
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'n') {
        event.preventDefault();
        currentActions.closeTransientUi();
        currentActions.openHabitModal();
        return;
      }

      if (key === 't') {
        event.preventDefault();
        const resolved = document.documentElement.getAttribute('data-theme') || currentState.settings.theme;
        currentActions.updateSettings({ theme: resolved === 'dark' ? 'light' : 'dark' });
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [latest]);
}
