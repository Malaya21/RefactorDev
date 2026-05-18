import { useMemo, useState } from 'react';
import HabitCard from '../components/HabitCard/HabitCard';
import { useApp } from '../context/AppContext';

export default function HabitsPage() {
  const { state, ui, actions } = useApp();
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('order');
  const categories = useMemo(() => [...new Set(state.habits.map((h) => h.category))].sort(), [state.habits]);
  const habits = useMemo(() => {
    const q = ui.search.trim().toLowerCase();
    return [...state.habits]
      .filter((h) => category === 'all' || h.category === category)
      .filter((h) => !q || h.title.toLowerCase().includes(q) || h.category.toLowerCase().includes(q) || (h.description || '').toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === 'name') return a.title.localeCompare(b.title);
        if (sort === 'streak') return (b.streak?.current || 0) - (a.streak?.current || 0);
        if (sort === 'created') return new Date(b.createdAt) - new Date(a.createdAt);
        return a.order - b.order;
      });
  }, [state.habits, ui.search, category, sort]);

  return (
    <section className="section active">
      <header className="section-header">
        <div><h1>Daily Habits</h1><p className="subtitle">Track, complete, and build streaks</p></div>
        <div className="habits-toolbar">
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
            <option value="all">All Categories</option>
            {categories.map((c) => <option value={c} key={c}>{c}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort habits">
            <option value="order">Custom Order</option>
            <option value="name">Name</option>
            <option value="streak">Streak</option>
            <option value="created">Created Date</option>
          </select>
        </div>
      </header>
      {habits.length ? <div className="habits-list">{habits.map((habit) => <HabitCard key={habit.id} habit={habit} />)}</div> : (
        <div className="empty-state">
          <span className="empty-icon">🌱</span>
          <h3>No habits yet</h3>
          <p>Start building discipline - add your first habit!</p>
          <button type="button" className="btn btn--primary" onClick={() => actions.openHabitModal()}>Add Habit</button>
        </div>
      )}
    </section>
  );
}
