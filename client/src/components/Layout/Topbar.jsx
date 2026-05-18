import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { todayKey } from '../../utils/date';
import { getStatus, isScheduledDay } from '../../services/streakService';

export default function Topbar() {
  const { state, ui, actions } = useApp();
  const navigate = useNavigate();
  const tasks = useMemo(() => {
    const today = todayKey();
    const d = new Date(`${today}T12:00:00`);
    const grouped = { pending: [], completed: [], missed: [] };
    state.habits.forEach((habit) => {
      if (!isScheduledDay(habit, d)) return;
      const status = getStatus(habit, today);
      if (status === 'completed') grouped.completed.push(habit);
      else if (status === 'missed') grouped.missed.push(habit);
      else grouped.pending.push(habit);
    });
    return grouped;
  }, [state.habits]);
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const theme = document.documentElement.getAttribute('data-theme') || state.settings.theme;

  return (
    <header className="topbar glass">
      <button type="button" className="btn-icon menu-toggle" onClick={() => actions.toggleSidebar()} aria-label="Toggle menu">
        {ui.sidebarOpen ? 'x' : '☰'}
      </button>
      <div className="topbar__search">
        <input id="global-search" value={ui.search} onChange={(e) => actions.setSearch(e.target.value)} type="search" placeholder="Search habits, notes... (Ctrl+K)" aria-label="Global search" />
      </div>
      <div className="topbar__actions">
        <span className="date-display">{date}</span>
        <button type="button" className="btn-icon theme-toggle" onClick={() => actions.updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })} aria-label="Toggle theme">
          {theme === 'dark' ? '🌙' : '☀'}
        </button>
        <div className="notif-wrap">
          <button type="button" className="btn-icon notif-btn" onClick={() => actions.toggleNotifications()} aria-label="Today's tasks" aria-expanded={ui.notificationOpen}>
            🔔<span className={`notif-badge ${tasks.pending.length ? '' : 'hidden'}`}>{tasks.pending.length}</span>
          </button>
          <div className={`notif-panel glass ${ui.notificationOpen ? '' : 'hidden'}`} role="dialog" aria-label="Today's tasks">
            <header className="notif-panel__header">
              <h3>Today&apos;s Tasks</h3>
              <button type="button" className="btn-icon notif-panel__close" onClick={() => actions.toggleNotifications(false)} aria-label="Close">x</button>
            </header>
            <ul className="notif-list">
              {!tasks.pending.length && !tasks.completed.length && !tasks.missed.length && <li className="notif-empty">No habits scheduled today.</li>}
              {!!tasks.pending.length && <li className="notif-section-title">Pending ({tasks.pending.length})</li>}
              {tasks.pending.map((habit) => (
                <li className="notif-item notif-item--pending" key={habit.id}>
                  <span>{habit.title}</span>
                  <button type="button" className="btn btn--success btn-sm" onClick={() => actions.markHabit(habit.id, 'completed')}>Done</button>
                </li>
              ))}
              {!!tasks.completed.length && <li className="notif-section-title">Completed ({tasks.completed.length})</li>}
              {tasks.completed.map((habit) => <li className="notif-item notif-item--done" key={habit.id}>✓ {habit.title}</li>)}
              {!!tasks.missed.length && <li className="notif-section-title">Missed ({tasks.missed.length})</li>}
              {tasks.missed.map((habit) => <li className="notif-item notif-item--miss" key={habit.id}>✗ {habit.title}</li>)}
            </ul>
            <footer className="notif-panel__footer">
              <button type="button" className="btn btn--ghost btn-sm" onClick={() => { actions.toggleNotifications(false); navigate('/habits'); }}>Go to Habits</button>
              <button type="button" className="btn btn--ghost btn-sm" onClick={() => { actions.toggleNotifications(false); navigate('/settings'); }}>Reminders</button>
            </footer>
          </div>
        </div>
      </div>
    </header>
  );
}
