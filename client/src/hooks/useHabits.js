import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

export function useHabits() {
  const { state, ui } = useApp();
  return useMemo(() => {
    const query = ui.search.trim().toLowerCase();
    return [...state.habits]
      .filter((habit) => !query || habit.title.toLowerCase().includes(query) || habit.category.toLowerCase().includes(query) || (habit.description || '').toLowerCase().includes(query))
      .sort((a, b) => a.order - b.order);
  }, [state.habits, ui.search]);
}
