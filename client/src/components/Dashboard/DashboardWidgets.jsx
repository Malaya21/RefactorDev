import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAnalytics } from '../../hooks/useAnalytics';
import { getStatus, isScheduledDay } from '../../services/streakService';
import { todayKey } from '../../utils/date';
import { getLevelProgress, getLevelTitle } from '../../utils/levelSystem';
import Icon from '../Icon/Icon';

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
  const { gamification } = useApp();
  const { stats, longest } = useAnalytics();
  const cards = [
    { icon: 'listChecks', value: stats.total, label: 'Total Habits', tone: 'indigo' },
    { icon: 'checkCircle', value: stats.completed, label: 'Completed Today', tone: 'emerald' },
    { icon: 'xCircle', value: stats.missed, label: 'Missed Today', tone: 'rose' },
    { icon: 'flame', value: longest, label: 'Longest Streak', tone: 'amber' },
    { icon: 'zap', value: gamification.totalXP || 0, label: 'Total XP', tone: 'violet' }
  ];
  return (
    <div className="stats-grid">
      {cards.map(({ icon, value, label, tone }, index) => (
        <article className={`stat-card stat-card--${tone} glass animate-slide-up`} style={{ '--delay': index }} key={label}>
          <span className="stat-icon"><Icon name={icon} size={23} /></span>
          <div className="stat-body">
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function XPProgressCard() {
  const { gamification } = useApp();
  const progress = getLevelProgress(gamification.totalXP || 0);
  const title = getLevelTitle(progress.level);

  return (
    <article className="xp-card glass">
      <div className="xp-card__header">
        <div className="xp-card__title">
          <span className="xp-level-badge"><Icon name="trophy" size={18} /> Level {progress.level}</span>
          <div>
          <span className="xp-kicker">Player Progress</span>
            <h2>{title}</h2>
          </div>
        </div>
        <strong><Icon name="zap" size={18} /> {gamification.totalXP || 0} XP</strong>
      </div>
      <div className="xp-progress" aria-label={`${progress.progress}% progress to next level`}>
        <span style={{ width: `${progress.progress}%` }}><i /></span>
      </div>
      <div className="xp-card__meta">
        <span><Icon name="target" size={15} /> {progress.remaining} XP to next level</span>
        <span><Icon name="flame" size={15} /> {gamification.streakBonus || 0} bonus XP</span>
        <span><Icon name="medal" size={15} /> {gamification.completedHabitsCount || 0} completions</span>
      </div>
    </article>
  );
}

export function TodaySummary() {
  const { state } = useApp();
  const { stats } = useAnalytics();
  const today = todayKey();
  const items = useMemo(() => state.habits.filter((h) => isScheduledDay(h, new Date(`${today}T12:00:00`))), [state.habits, today]);
  return (
    <div className="today-summary">
      <p className="summary-stats">{stats.completed}/{stats.scheduled} completed - {stats.pending} pending</p>
      <div className="summary-list">
        {items.map((habit) => {
          const status = getStatus(habit, today);
          const icon = status === 'done' ? 'checkCircle' : status === 'missed' ? 'xCircle' : 'circleDashed';
          return <div className={`summary-row summary-row--${status || 'pending'}`} key={habit.id}><span><Icon name={icon} size={17} /></span><span>{habit.title}</span></div>;
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
          <span className={`streak-flame ${habit.streak?.current >= 3 ? 'streak-flame--active' : ''}`}><Icon name="flame" size={18} /></span>
          <span className="name">{habit.title}</span>
          <span className="count">{habit.streak?.current || 0} days</span>
        </li>
      ))}
    </ul>
  );
}

export function Achievements() {
  const { state } = useApp();
  const totalCompleted = state.habits.reduce((n, h) => n + Object.values(h.history || {}).filter((s) => s === 'done' || s === 'completed').length, 0);
  const { stats } = useAnalytics();
  const achievements = [
    ['sparkles', 'First Step', totalCompleted >= 1],
    ['flame', 'On Fire', state.habits.some((h) => h.streak?.current >= 3)],
    ['zap', 'Week Warrior', state.habits.some((h) => h.streak?.current >= 7)],
    ['trophy', 'Perfect Day', stats.score === 100 && stats.scheduled > 0],
    ['target', 'Full Roster', state.habits.length >= 8],
    ['notebookPen', 'Reflective', state.notes.length >= 5]
  ];
  return <div className="badges">{achievements.map(([icon, title, on]) => <div className={`badge ${on ? 'unlocked' : 'locked'}`} key={title}><span className="badge-icon"><Icon name={icon} size={20} /></span><span className="badge-title">{title}</span></div>)}</div>;
}
