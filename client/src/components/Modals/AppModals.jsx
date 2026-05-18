import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { todayKey } from '../../utils/date';

const categories = ['Health', 'Fitness', 'Learning', 'Career', 'Mindfulness', 'Lifestyle', 'Other'];

export default function AppModals() {
  const { ui } = useApp();
  return (
    <>
      {ui.activeModal === 'habit' && <HabitModal />}
      {ui.activeModal === 'note' && <NoteModal />}
      {ui.activeModal === 'habit-note' && <HabitNoteModal />}
    </>
  );
}

function ModalShell({ children }) {
  const { actions } = useApp();
  return <div className="modal-backdrop" onMouseDown={actions.closeModal}><dialog open className="modal glass" onMouseDown={(e) => e.stopPropagation()}>{children}</dialog></div>;
}

function HabitModal() {
  const { ui, actions } = useApp();
  const habit = ui.editingHabit;
  const [form, setForm] = useState(() => ({
    id: habit?.id || '',
    title: habit?.title || '',
    description: habit?.description || '',
    category: habit?.category || 'Health',
    target: habit?.target || '',
    frequency: habit?.frequency || 'daily',
    customDays: habit?.customDays || [0, 1, 2, 3, 4, 5, 6]
  }));
  const showDays = form.frequency === 'weekly' || form.frequency === 'custom';

  const toggleDay = (day) => setForm((f) => ({
    ...f,
    customDays: f.customDays.includes(day) ? f.customDays.filter((d) => d !== day) : [...f.customDays, day].sort()
  }));

  return (
    <ModalShell>
      <form className="modal__form" onSubmit={(e) => { e.preventDefault(); actions.saveHabit(form); actions.closeModal(); }}>
        <header className="modal__header"><h2>{form.id ? 'Edit Habit' : 'Add Habit'}</h2><button type="button" className="btn-icon modal-close" onClick={actions.closeModal}>×</button></header>
        <label>Title <input value={form.title} required maxLength="80" onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Read 15 minutes" /></label>
        <label>Description <textarea value={form.description} rows="2" onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional details" /></label>
        <div className="form-row">
          <label>Category <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((c) => <option value={c} key={c}>{c}</option>)}</select></label>
          <label>Target <input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="e.g. 15 min" /></label>
        </div>
        <div className="form-row">
          <label>Frequency <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value, customDays: e.target.value === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : form.customDays })}><option value="daily">Daily</option><option value="weekly">Weekly (select days)</option><option value="custom">Custom Days</option></select></label>
        </div>
        {showDays && <fieldset className="custom-days"><legend>Active days</legend><div className="day-pills">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => <label key={label}><input type="checkbox" checked={form.customDays.includes(index)} onChange={() => toggleDay(index)} /> {label}</label>)}</div></fieldset>}
        <footer className="modal__footer"><button type="button" className="btn btn--ghost" onClick={actions.closeModal}>Cancel</button><button type="submit" className="btn btn--primary">Save Habit</button></footer>
      </form>
    </ModalShell>
  );
}

function NoteModal() {
  const { ui, actions } = useApp();
  const note = ui.editingNote;
  const [form, setForm] = useState({ id: note?.id || '', date: note?.date || todayKey(), mood: note?.mood || 'neutral', content: note?.content || '' });
  return (
    <ModalShell>
      <form className="modal__form" onSubmit={(e) => { e.preventDefault(); actions.saveNote(form); actions.closeModal(); }}>
        <header className="modal__header"><h2>{form.id ? 'Edit Entry' : 'New Journal Entry'}</h2><button type="button" className="btn-icon modal-close" onClick={actions.closeModal}>×</button></header>
        <label>Date <input type="date" value={form.date} required onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
        <label>Mood <select value={form.mood} onChange={(e) => setForm({ ...form, mood: e.target.value })}><option value="great">😄 Great</option><option value="good">🙂 Good</option><option value="neutral">😐 Neutral</option><option value="low">😔 Low</option><option value="bad">😢 Bad</option></select></label>
        <label>Reflection <textarea value={form.content} rows="6" required onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="How was your day? What did you learn?" /></label>
        <footer className="modal__footer"><button type="button" className="btn btn--ghost" onClick={actions.closeModal}>Cancel</button><button type="submit" className="btn btn--primary">Save Entry</button></footer>
      </form>
    </ModalShell>
  );
}

function HabitNoteModal() {
  const { state, ui, actions } = useApp();
  const habit = useMemo(() => state.habits.find((h) => h.id === ui.habitNoteId), [state.habits, ui.habitNoteId]);
  const [text, setText] = useState('');
  useEffect(() => {
    setText((habit?.habitNotes || {})[todayKey()] || '');
  }, [habit]);
  if (!habit) return null;
  return (
    <ModalShell>
      <form className="modal__form" onSubmit={(e) => { e.preventDefault(); actions.saveHabitNote(habit.id, text); actions.closeModal(); }}>
        <header className="modal__header"><h2>Habit Note</h2><button type="button" className="btn-icon modal-close" onClick={actions.closeModal}>×</button></header>
        <label>Note for today <textarea value={text} rows="4" onChange={(e) => setText(e.target.value)} /></label>
        <footer className="modal__footer"><button type="button" className="btn btn--ghost" onClick={actions.closeModal}>Cancel</button><button type="submit" className="btn btn--primary">Save</button></footer>
      </form>
    </ModalShell>
  );
}
