/**
 * notes.js — Journal entries, mood tracking, search
 */
const Notes = (() => {
  const MOOD_EMOJI = { great: '😄', good: '🙂', neutral: '😐', low: '😔', bad: '😢' };

  function getAll(data) {
    return [...(data.notes || [])].sort((a, b) => b.date.localeCompare(a.date));
  }

  function getById(data, id) {
    return data.notes.find((n) => n.id === id);
  }

  function add(data, payload) {
    const note = {
      id: Storage.uid(),
      date: payload.date,
      mood: payload.mood || 'neutral',
      content: Storage.sanitizeString(payload.content, '', 5000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.notes.push(note);
    return note;
  }

  function update(data, id, payload) {
    const n = getById(data, id);
    if (!n) return null;
    n.date = payload.date;
    n.mood = payload.mood;
    n.content = Storage.sanitizeString(payload.content, '', 5000);
    n.updatedAt = new Date().toISOString();
    return n;
  }

  function remove(data, id) {
    data.notes = data.notes.filter((n) => n.id !== id);
  }

  function filter(notes, { search = '', date = '' } = {}) {
    let list = [...notes];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((n) => n.content.toLowerCase().includes(q) || n.date.includes(q));
    if (date) list = list.filter((n) => n.date === date);
    return list;
  }

  function renderCard(note) {
    const safeId = Habits.escapeAttr(note.id);
    const mood = Habits.escapeHtml(note.mood);
    return `
      <article class="note-card glass" data-id="${safeId}">
        <header class="note-card__header">
          <span class="note-mood">${MOOD_EMOJI[note.mood] || '😐'} ${mood}</span>
          <time>${formatDate(note.date)}</time>
        </header>
        <p class="note-content">${Habits.escapeHtml(note.content)}</p>
        <footer class="note-card__footer">
          <button type="button" class="btn btn--ghost btn-sm" data-action="edit-note" data-id="${safeId}">Edit</button>
          <button type="button" class="btn btn--ghost btn-sm danger" data-action="delete-note" data-id="${safeId}">Delete</button>
        </footer>
      </article>`;
  }

  function formatDate(key) {
    const d = new Date(key + 'T12:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  }

  return { getAll, getById, add, update, remove, filter, renderCard, MOOD_EMOJI };
})();
