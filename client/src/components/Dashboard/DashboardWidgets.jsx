import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAnalytics } from '../../hooks/useAnalytics';
import { getStatus, isScheduledDay } from '../../services/streakService';
import { todayKey } from '../../utils/date';

export function ProductivityRing({ score }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  return (
    <div className="productivity-ring" title="Productivity score">
      <svg viewBox="0 0 100 100">
        <circle className="ring-bg" cx="50" cy="50" r={r} />
        <circle className="ring-fill" cx="50" cy="50" r={r} style={{ strokeDasharray: circ, strokeDashoffset: circ - (score / 100) * circ }} />
      </svg>
      <span className="ring-label">{score}%</span>
    </div>
  );
}

export function StatsGrid() {
  const { stats, longest } = useAnalytics();
  const cards = [
    ['📋', stats.total, 'Total Habits'],
    ['✅', stats.completed, 'Completed Today'],
    ['❌', stats.missed, 'Missed Today'],
    ['🔥', longest, 'Longest Streak']
  ];
  return (
    <div className="stats-grid">
      {cards.map(([icon, value, label], index) => (
        <article className="stat-card glass animate-slide-up" style={{ '--delay': index }} key={label}>
          <span className="stat-icon">{icon}</span>
          <div className="stat-body">
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function TodaySummary() {
  const { state } = useApp();
  const { stats } = useAnalytics();
  const today = todayKey();
  const items = useMemo(() => state.habits.filter((h) => isScheduledDay(h, new Date(`${today}T12:00:00`))), [state.habits, today]);
  return (
    <div className="today-summary">
      <p className="summary-stats">{stats.completed}/{stats.scheduled} completed · {stats.pending} pending</p>
      <div className="summary-list">
        {items.map((habit) => {
          const status = getStatus(habit, today);
          const icon = status === 'completed' ? '✅' : status === 'missed' ? '❌' : '⏳';
          return <div className="summary-row" key={habit.id}><span>{icon}</span><span>{habit.title}</span></div>;
        })}
        {!items.length && <p className="empty-hint">No habits scheduled today</p>}
      </div>
    </div>
  );
}

export function WeeklyOverview() {
  const { weekly } = useAnalytics();
  return (
    <div className="weekly-bars">
      {weekly.map((day) => (
        <div className="week-bar-item" key={day.date}>
          <div className="week-bar"><div className={`week-bar-fill ${day.pct === 0 ? 'week-bar-fill--empty' : ''}`} style={{ height: `${day.pct === 0 ? 4 : day.pct}%` }} /></div>
          <span>{day.label}</span>
          <small>{day.pct}%</small>
        </div>
      ))}
    </div>
  );
}

export function StreakList() {
  const { state } = useApp();
  const top = [...state.habits].sort((a, b) => (b.streak?.current || 0) - (a.streak?.current || 0)).slice(0, 5);
  return (
    <ul className="streak-list">
      {top.map((habit) => (
        <li className="streak-list-item" key={habit.id}>
          <span className={`streak-flame ${habit.streak?.current >= 3 ? 'streak-flame--active' : ''}`}>🔥</span>
          <span className="name">{habit.title}</span>
          <span className="count">{habit.streak?.current || 0} days</span>
        </li>
      ))}
    </ul>
  );
}

export function Achievements() {
  const { state } = useApp();
  const totalCompleted = state.habits.reduce((n, h) => n + Object.values(h.history || {}).filter((s) => s === 'completed').length, 0);
  const { stats } = useAnalytics();
  const achievements = [
    ['🌱', 'First Step', totalCompleted >= 1],
    ['🔥', 'On Fire', state.habits.some((h) => h.streak?.current >= 3)],
    ['⚡', 'Week Warrior', state.habits.some((h) => h.streak?.current >= 7)],
    ['💎', 'Perfect Day', stats.score === 100 && stats.scheduled > 0],
    ['🎯', 'Full Roster', state.habits.length >= 8],
    ['📓', 'Reflective', state.notes.length >= 5]
  ];
  return <div className="badges">{achievements.map(([icon, title, on]) => <div className={`badge ${on ? 'unlocked' : 'locked'}`} key={title}><span className="badge-icon">{icon}</span><span className="badge-title">{title}</span></div>)}</div>;
}
