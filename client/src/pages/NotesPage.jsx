import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';

const MOOD_EMOJI = { great: '😄', good: '🙂', neutral: '😐', low: '😔', bad: '😢' };

function formatDate(key) {
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export default function NotesPage() {
  const { state, actions } = useApp();
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const notes = useMemo(() => [...state.notes]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((note) => !search || note.content.toLowerCase().includes(search.toLowerCase()) || note.date.includes(search))
    .filter((note) => !date || note.date === date), [state.notes, search, date]);

  return (
    <section className="section active notes-page">
      <header className="section-header">
        <div>
          <h1>Notes & Journal</h1>
          <p className="subtitle">Daily reflections and mood tracking</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => actions.openNoteModal()}>+ New Entry</button>
      </header>

      <div className="notes-toolbar">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes..." />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {notes.length ? (
        <div className="notes-list notes-list--react">
          {notes.map((note) => <NoteCard key={note.id} note={note} />)}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">📓</span>
          <h3>No journal entries</h3>
          <p>Capture your thoughts and track your mood.</p>
        </div>
      )}
    </section>
  );
}

function NoteCard({ note }) {
  const { actions } = useApp();
  return (
    <article className="note-card glass note-card--react">
      <header className="note-card__header">
        <div className="note-card__mood-wrap">
          <span className="note-mood-icon">{MOOD_EMOJI[note.mood] || '😐'}</span>
          <div className="note-card__mood-text">
            <span className="note-mood">{note.mood}</span>
            <span className="note-kicker">Journal entry</span>
          </div>
        </div>
        <time className="note-date">{formatDate(note.date)}</time>
      </header>

      <div className="note-content-wrap">
        <p className="note-content">{note.content}</p>
      </div>

      <footer className="note-card__footer">
        <button type="button" className="btn btn--ghost btn-sm" onClick={() => actions.openNoteModal(note)}>Edit</button>
        <button type="button" className="btn btn--ghost btn-sm danger" onClick={() => window.confirm('Delete this entry?') && actions.deleteNote(note.id)}>Delete</button>
      </footer>
    </article>
  );
}
