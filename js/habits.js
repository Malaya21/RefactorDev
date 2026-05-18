/**
 * habits.js — Habit CRUD, filtering, sorting, drag reorder
 */
const Habits = (() => {
  let dragId = null;

  function getAll(data) {
    return [...(data.habits || [])].sort((a, b) => a.order - b.order);
  }

  function getById(data, id) {
    return data.habits.find((h) => h.id === id);
  }

  function add(data, payload) {
    const frequency = ['daily', 'weekly', 'custom'].includes(payload.frequency) ? payload.frequency : 'daily';
    const habit = {
      id: Storage.uid(),
      title: Storage.sanitizeString(payload.title, 'Untitled Habit', 80),
      description: Storage.sanitizeString(payload.description, '', 500),
      category: Storage.sanitizeString(payload.category, 'Other', 40) || 'Other',
      target: Storage.sanitizeString(payload.target, '', 120),
      frequency,
      customDays: payload.customDays || [0, 1, 2, 3, 4, 5, 6],
      createdAt: new Date().toISOString(),
      order: data.habits.length,
      history: {},
      habitNotes: {},
      streak: { current: 0, longest: 0 },
      consistency: 0
    };
    Streak.recalculate(habit);
    data.habits.push(habit);
    return habit;
  }

  function update(data, id, payload) {
    const h = getById(data, id);
    if (!h) return null;
    Object.assign(h, {
      title: Storage.sanitizeString(payload.title, h.title || 'Untitled Habit', 80),
      description: Storage.sanitizeString(payload.description, '', 500),
      category: Storage.sanitizeString(payload.category, 'Other', 40) || 'Other',
      target: Storage.sanitizeString(payload.target, '', 120),
      frequency: ['daily', 'weekly', 'custom'].includes(payload.frequency) ? payload.frequency : 'daily',
      customDays: payload.customDays
    });
    Streak.recalculate(h);
    return h;
  }

  function remove(data, id) {
    data.habits = data.habits.filter((h) => h.id !== id);
  }

  function reorder(data, fromId, toId) {
    const habits = getAll(data);
    const fromIdx = habits.findIndex((h) => h.id === fromId);
    const toIdx = habits.findIndex((h) => h.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [item] = habits.splice(fromIdx, 1);
    habits.splice(toIdx, 0, item);
    habits.forEach((h, i) => (h.order = i));
    data.habits = habits;
  }

  function filterAndSort(habits, { search = '', category = 'all', sort = 'order' } = {}) {
    let list = [...habits];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          (h.description || '').toLowerCase().includes(q) ||
          h.category.toLowerCase().includes(q)
      );
    }
    if (category !== 'all') list = list.filter((h) => h.category === category);

    switch (sort) {
      case 'name':
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'streak':
        list.sort((a, b) => b.streak.current - a.streak.current);
        break;
      case 'created':
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      default:
        list.sort((a, b) => a.order - b.order);
    }
    return list;
  }

  function getCategories(data) {
    return [...new Set(data.habits.map((h) => h.category))].sort();
  }

  function todayStats(data) {
    const today = Storage.todayKey();
    let completed = 0;
    let missed = 0;
    let pending = 0;
    let scheduled = 0;

    data.habits.forEach((h) => {
      const d = new Date(today + 'T12:00:00');
      if (!Streak.isScheduledDay(h, d)) return;
      scheduled++;
      const st = Streak.getStatus(h, today);
      if (st === 'completed') completed++;
      else if (st === 'missed') missed++;
      else pending++;
    });

    const score = scheduled ? Math.round((completed / scheduled) * 100) : 0;
    return { completed, missed, pending, scheduled, total: data.habits.length, score };
  }

  function globalLongestStreak(data) {
    return data.habits.reduce((max, h) => Math.max(max, h.streak.longest), 0);
  }

  function setHabitNote(habit, dateKey, text) {
    if (!habit.habitNotes) habit.habitNotes = {};
    if (text) habit.habitNotes[dateKey] = text;
    else delete habit.habitNotes[dateKey];
  }

  function getHabitNote(habit, dateKey) {
    return (habit.habitNotes || {})[dateKey] || '';
  }

  function renderCard(habit, today = Storage.todayKey()) {
    const status = Streak.getStatus(habit, today) || null;
    const statusClass = status === 'completed' ? 'completed' : status === 'missed' ? 'missed' : '';
    const scheduled = Streak.isScheduledDay(habit, new Date(today + 'T12:00:00'));
    const lastDone = Streak.getLastCompletedDate(habit);
    const note = getHabitNote(habit, today);
    const progress = habit.consistency;
    const circumference = 2 * Math.PI * 18;
    const offset = circumference - (progress / 100) * circumference;
    const safeId = escapeAttr(habit.id);
    const safeCategoryClass = sanitizeClassName(habit.category);

    return `
      <article class="habit-card glass ${statusClass} ${!scheduled ? 'habit-card--rest' : ''}"
        data-id="${safeId}" draggable="true">
        <div class="habit-card__drag" title="Drag to reorder">⋮⋮</div>
        <div class="habit-card__header">
          <div class="habit-card__title-row">
            <h3>${escapeHtml(habit.title)}</h3>
            <span class="tag tag--${safeCategoryClass}">${escapeHtml(habit.category)}</span>
          </div>
          ${habit.description ? `<p class="habit-desc">${escapeHtml(habit.description)}</p>` : ''}
        </div>
        <div class="habit-card__meta">
          <span>🎯 ${escapeHtml(habit.target || '—')}</span>
          <span>📅 ${formatFrequency(habit)}</span>
        </div>
        <div class="habit-card__progress">
          <svg class="mini-ring" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="18" class="ring-bg"/>
            <circle cx="22" cy="22" r="18" class="ring-fill" style="stroke-dasharray:${circumference};stroke-dashoffset:${offset}"/>
          </svg>
          <span>${progress}% consistent</span>
        </div>
        <div class="habit-card__streak">
          <span class="streak-flame ${habit.streak.current >= 3 ? 'streak-flame--active' : ''}">🔥</span>
          <span class="streak-num">${habit.streak.current}</span>
          <span class="streak-label">day streak</span>
          <span class="streak-best">Best: ${habit.streak.longest}</span>
        </div>
        ${scheduled ? `
        <div class="habit-card__actions">
          <button type="button" class="btn btn--success btn-sm ${status === 'completed' ? 'active' : ''}" data-action="complete" data-id="${safeId}">✓ Done</button>
          <button type="button" class="btn btn--ghost btn-sm ${status === 'missed' ? 'active' : ''}" data-action="miss" data-id="${safeId}">✗ Miss</button>
          <button type="button" class="btn btn--ghost btn-sm" data-action="habit-note" data-id="${safeId}">📝</button>
          <button type="button" class="btn btn--ghost btn-sm" data-action="edit" data-id="${safeId}">✎</button>
          <button type="button" class="btn btn--ghost btn-sm danger" data-action="delete" data-id="${safeId}">🗑</button>
        </div>` : `<p class="rest-day">Rest day — no tracking required</p>`}
        ${note ? `<p class="habit-inline-note">"${escapeHtml(note)}"</p>` : ''}
        <footer class="habit-card__footer">
          <span>Created ${formatDate(habit.createdAt)}</span>
          <span>${lastDone ? `Last done ${formatDate(lastDone)}` : 'Not completed yet'}</span>
        </footer>
      </article>`;
  }

  function escapeHtml(s) {
    return Security.escapeHTML(s);
  }

  function escapeAttr(s) {
    return Security.escapeAttribute(s);
  }

  function sanitizeClassName(s) {
    return Security.sanitizeClassName(s);
  }

  function slug(s) {
    return sanitizeClassName(s);
  }

  function formatDate(isoOrKey) {
    const d = isoOrKey.length === 10 ? new Date(isoOrKey + 'T12:00:00') : new Date(isoOrKey);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatFrequency(h) {
    if (h.frequency === 'daily') return 'Daily';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (h.customDays || []).map((d) => days[d]).join(', ');
  }

  function bindDragDrop(container, onReorder) {
    container.querySelectorAll('.habit-card').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        dragId = card.dataset.id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        dragId = null;
      });
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        const over = card.dataset.id;
        if (over && dragId && over !== dragId) card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const toId = card.dataset.id;
        if (dragId && toId && dragId !== toId) onReorder(dragId, toId);
      });
    });
  }

  return {
    getAll,
    getById,
    add,
    update,
    remove,
    reorder,
    filterAndSort,
    getCategories,
    todayStats,
    globalLongestStreak,
    setHabitNote,
    getHabitNote,
    renderCard,
    bindDragDrop,
    escapeHtml,
    escapeAttr,
    sanitizeClassName
  };
})();
