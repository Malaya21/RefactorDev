import { sanitizeClassName } from '../../utils/security';
import { todayKey } from '../../utils/date';
import { getLastCompletedDate, getStatus, isScheduledDay } from '../../services/streakService';
import { useApp } from '../../context/AppContext';

function formatDate(value) {
  const d = String(value).length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFrequency(habit) {
  if (habit.frequency === 'daily') return 'Daily';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (habit.customDays || []).map((d) => days[d]).join(', ');
}

export default function HabitCard({ habit }) {
  const { actions } = useApp();
  const today = todayKey();
  const status = getStatus(habit, today);
  const scheduled = isScheduledDay(habit, new Date(`${today}T12:00:00`));
  const lastDone = getLastCompletedDate(habit);
  const note = (habit.habitNotes || {})[today];
  const progress = habit.consistency || 0;
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <article className={`habit-card glass ${status === 'completed' ? 'completed' : ''} ${status === 'missed' ? 'missed' : ''} ${!scheduled ? 'habit-card--rest' : ''}`} data-id={habit.id}>
      <div className="habit-card__drag" title="Drag to reorder">⋮⋮</div>
      <div className="habit-card__header">
        <div className="habit-card__title-row">
          <h3>{habit.title}</h3>
          <span className={`tag tag--${sanitizeClassName(habit.category)}`}>{habit.category}</span>
        </div>
        {habit.description && <p className="habit-desc">{habit.description}</p>}
      </div>
      <div className="habit-card__meta">
        <span>🎯 {habit.target || '—'}</span>
        <span>📅 {formatFrequency(habit)}</span>
      </div>
      <div className="habit-card__progress">
        <svg className="mini-ring" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" className="ring-bg" />
          <circle cx="22" cy="22" r="18" className="ring-fill" style={{ strokeDasharray: circumference, strokeDashoffset: offset }} />
        </svg>
        <span>{progress}% consistent</span>
      </div>
      <div className="habit-card__streak">
        <span className={`streak-flame ${habit.streak?.current >= 3 ? 'streak-flame--active' : ''}`}>🔥</span>
        <span className="streak-num">{habit.streak?.current || 0}</span>
        <span className="streak-label">day streak</span>
        <span className="streak-best">Best: {habit.streak?.longest || 0}</span>
      </div>
      {scheduled ? (
        <div className="habit-card__actions">
          <button type="button" className={`btn btn--success btn-sm ${status === 'completed' ? 'active' : ''}`} onClick={() => actions.markHabit(habit.id, 'completed')}>✓ Done</button>
          <button type="button" className={`btn btn--ghost btn-sm ${status === 'missed' ? 'active' : ''}`} onClick={() => actions.markHabit(habit.id, 'missed')}>✗ Miss</button>
          <button type="button" className="btn btn--ghost btn-sm" onClick={() => actions.openHabitNote(habit.id)}>📝</button>
          <button type="button" className="btn btn--ghost btn-sm" onClick={() => actions.openHabitModal(habit)}>✎</button>
          <button type="button" className="btn btn--ghost btn-sm danger" onClick={() => window.confirm(`Delete "${habit.title}"?`) && actions.deleteHabit(habit.id)}>🗑</button>
        </div>
      ) : <p className="rest-day">Rest day - no tracking required</p>}
      {note && <p className="habit-inline-note">&quot;{note}&quot;</p>}
      <footer className="habit-card__footer">
        <span>Created {formatDate(habit.createdAt)}</span>
        <span>{lastDone ? `Last done ${formatDate(lastDone)}` : 'Not completed yet'}</span>
      </footer>
    </article>
  );
}
