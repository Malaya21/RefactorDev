import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { saveState } from '../storage/storageService';

export function useLocalStorageSync() {
  const { state } = useApp();
  return useCallback(() => saveState(state), [state]);
}
