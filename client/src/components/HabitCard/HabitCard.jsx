import { sanitizeClassName } from '../../utils/security';
import { todayKey } from '../../utils/date';
import { getLastCompletedDate, getStatus, isScheduledDay } from '../../services/streakService';
import { useApp } from '../../context/AppContext';
import { canEditDate, getEditableDateLabel, LOCKED_DATE_MESSAGE } from '../../utils/dateLocks';
import Icon from '../Icon/Icon';

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
  const { state, actions } = useApp();
  const selectedDate = state.activeDate || todayKey();
  const status = getStatus(habit, selectedDate);
  const scheduled = isScheduledDay(habit, new Date(`${selectedDate}T12:00:00`));
  const editable = canEditDate(selectedDate);
  const dateLabel = getEditableDateLabel(selectedDate);
  const lastDone = getLastCompletedDate(habit);
  const note = (habit.habitNotes || {})[selectedDate];
  const progress = habit.consistency || 0;
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (progress / 100) * circumference;
  const guardLocked = (callback) => {
    if (!editable) {
      actions.toast(LOCKED_DATE_MESSAGE, 'warning');
      return;
    }
    callback();
  };

  return (
    <article className={`habit-card glass ${status === 'done' ? 'completed' : ''} ${status === 'missed' ? 'missed' : ''} ${!scheduled ? 'habit-card--rest' : ''} ${!editable ? 'habit-card--locked' : ''}`} data-id={habit.id}>
      <div className="habit-card__drag" title="Drag to reorder">::</div>
      <div className="habit-card__header">
        <div className="habit-card__title-row">
          <h3>{habit.title}</h3>
          <span className={`tag tag--${sanitizeClassName(habit.category)}`}>{habit.category}</span>
        </div>
        {habit.description && <p className="habit-desc">{habit.description}</p>}
      </div>
      <div className="habit-card__date">
        <span>{selectedDate}</span>
        <strong className={!editable ? 'locked' : ''} title={!editable ? LOCKED_DATE_MESSAGE : undefined}>
          {editable ? dateLabel : 'Read-only'}
        </strong>
      </div>
      <div className="habit-card__meta">
        <span>Target: {habit.target || '-'}</span>
        <span>Schedule: {formatFrequency(habit)}</span>
      </div>
      <div className="habit-card__progress">
        <svg className="mini-ring" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" className="ring-bg" />
          <circle cx="22" cy="22" r="18" className="ring-fill" style={{ strokeDasharray: circumference, strokeDashoffset: offset }} />
        </svg>
        <span>{progress}% consistent</span>
      </div>
      <div className="habit-card__streak">
        <span className={`streak-flame ${habit.streak?.current >= 3 ? 'streak-flame--active' : ''}`}><Icon name="flame" size={18} /></span>
        <span className="streak-num">{habit.streak?.current || 0}</span>
        <span className="streak-label">day streak</span>
        <span className="streak-best">Best: {habit.streak?.longest || 0}</span>
      </div>
      {scheduled ? (
        <div className="habit-card__actions">
          <button type="button" className={`btn btn--success btn-sm ${status === 'done' ? 'active' : ''}`} aria-disabled={!editable} title={!editable ? LOCKED_DATE_MESSAGE : 'Mark done'} onClick={() => guardLocked(() => actions.markHabit(habit.id, 'done', selectedDate))}>Done</button>
          <button type="button" className={`btn btn--ghost btn-sm ${status === 'missed' ? 'active' : ''}`} aria-disabled={!editable} title={!editable ? LOCKED_DATE_MESSAGE : 'Mark missed'} onClick={() => guardLocked(() => actions.markHabit(habit.id, 'missed', selectedDate))}>Miss</button>
          <button type="button" className="btn btn--ghost btn-sm" aria-disabled={!editable} title={!editable ? LOCKED_DATE_MESSAGE : 'Add note'} onClick={() => guardLocked(() => actions.openHabitNote(habit.id))}>Note</button>
          <button type="button" className="btn btn--ghost btn-sm" onClick={() => actions.openHabitModal(habit)}>Edit</button>
          <button type="button" className="btn btn--ghost btn-sm danger" onClick={() => window.confirm(`Delete "${habit.title}"?`) && actions.deleteHabit(habit.id)}>Delete</button>
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
