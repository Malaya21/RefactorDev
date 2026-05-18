/**
 * app.js — Main application bootstrap & event wiring
 */
const App = (() => {
  let state = null;
  let searchQuery = '';
  let resizeTimer = null;

  function persist() {
    AppState.commit();
    render();
  }

  function render() {
    renderDashboard();
    renderHabits();
    renderNotes();
    renderSettings();
    UI.updateNotifBadge(state);
    document.getElementById('sidebar-best-streak').textContent = Habits.globalLongestStreak(state);
    const quote = Storage.getQuote(state.quoteIndex);
    document.getElementById('motivational-quote').textContent = `"${quote.text}"`;
    document.getElementById('quote-author').textContent = `— ${quote.author}`;
  }

  function renderDashboard() {
    const stats = Habits.todayStats(state);
    UI.animateCounter(document.getElementById('stat-total'), stats.total);
    UI.animateCounter(document.getElementById('stat-completed'), stats.completed);
    UI.animateCounter(document.getElementById('stat-missed'), stats.missed);
    UI.animateCounter(document.getElementById('stat-longest'), Habits.globalLongestStreak(state));
    UI.updateProductivityRing(stats.score);
    UI.renderTodaySummary(document.getElementById('today-summary'), state);
    UI.renderStreakList(document.getElementById('current-streaks-list'), state);
    UI.renderAchievements(document.getElementById('achievements-badges'), state);
    Analytics.renderWeeklyOverview(document.getElementById('weekly-overview'), Analytics.getDailyCompletion(state, 7));
  }

  function renderHabits() {
    const list = document.getElementById('habits-list');
    const empty = document.getElementById('habits-empty');
    const category = document.getElementById('filter-category')?.value || 'all';
    const sort = document.getElementById('sort-habits')?.value || 'order';
    const habits = Habits.filterAndSort(state.habits, { search: searchQuery, category, sort });

    populateCategoryFilter();

    if (!habits.length) {
      list.replaceChildren();
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      list.innerHTML = habits.map((h) => Habits.renderCard(h)).join('');
      Habits.bindDragDrop(list, (from, to) => {
        Habits.reorder(state, from, to);
        persist();
        UI.toast('Habits reordered', 'info');
      });
    }
  }

  function populateCategoryFilter() {
    const sel = document.getElementById('filter-category');
    if (!sel) return;
    const current = sel.value;
    const cats = Habits.getCategories(state);
    sel.replaceChildren(new Option('All Categories', 'all'), ...cats.map((c) => new Option(c, c)));
    if ([...sel.options].some((o) => o.value === current)) sel.value = current;
  }

  function renderNotes() {
    const search = document.getElementById('notes-search')?.value || '';
    const date = document.getElementById('notes-filter-date')?.value || '';
    const notes = Notes.filter(Notes.getAll(state), { search, date });
    const list = document.getElementById('notes-list');
    const empty = document.getElementById('notes-empty');
    if (!notes.length) {
      list.replaceChildren();
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      list.innerHTML = notes.map((n) => Notes.renderCard(n)).join('');
    }
  }

  function renderSettings() {
    Notifications.renderReminderSettings(document.getElementById('reminder-list'), state, persist);
  }

  function openHabitModal(habit = null) {
    const form = document.getElementById('habit-form');
    form.reset();
    document.getElementById('habit-modal-title').textContent = habit ? 'Edit Habit' : 'Add Habit';
    document.getElementById('habit-id').value = habit?.id || '';

    if (habit) {
      document.getElementById('habit-title').value = habit.title;
      document.getElementById('habit-description').value = habit.description || '';
      document.getElementById('habit-category').value = habit.category;
      document.getElementById('habit-target').value = habit.target || '';
      document.getElementById('habit-frequency').value = habit.frequency;
      toggleCustomDays(habit.frequency);
      document.querySelectorAll('#custom-days-field input').forEach((cb) => {
        cb.checked = (habit.customDays || []).includes(Number(cb.value));
      });
    } else {
      toggleCustomDays('daily');
    }
    UI.openModal('habit-modal');
  }

  function toggleCustomDays(freq) {
    const field = document.getElementById('custom-days-field');
    const show = freq === 'weekly' || freq === 'custom';
    field.classList.toggle('hidden', !show);
    if (show && freq === 'weekly') {
      document.querySelectorAll('#custom-days-field input').forEach((cb) => {
        if ([1, 2, 3, 4, 5, 6].includes(Number(cb.value))) cb.checked = true;
      });
    }
  }

  function getCustomDaysFromForm() {
    return [...document.querySelectorAll('#custom-days-field input:checked')].map((cb) => Number(cb.value));
  }

  function saveHabitFromForm(e) {
    e.preventDefault();
    const id = document.getElementById('habit-id').value;
    const payload = {
      title: document.getElementById('habit-title').value.trim(),
      description: document.getElementById('habit-description').value.trim(),
      category: document.getElementById('habit-category').value,
      target: document.getElementById('habit-target').value.trim(),
      frequency: document.getElementById('habit-frequency').value,
      customDays: getCustomDaysFromForm()
    };
    if (!payload.title) return;

    if (id) {
      Habits.update(state, id, payload);
      UI.toast('Habit updated', 'success');
    } else {
      Habits.add(state, payload);
      UI.toast('Habit added', 'success');
    }
    UI.closeModal(document.getElementById('habit-modal'));
    persist();
  }

  function openNoteModal(note = null) {
    document.getElementById('note-modal-title').textContent = note ? 'Edit Entry' : 'New Journal Entry';
    document.getElementById('note-id').value = note?.id || '';
    document.getElementById('note-date').value = note?.date || Storage.todayKey();
    document.getElementById('note-mood').value = note?.mood || 'neutral';
    document.getElementById('note-content').value = note?.content || '';
    UI.openModal('note-modal');
  }

  function saveNoteFromForm(e) {
    e.preventDefault();
    const id = document.getElementById('note-id').value;
    const payload = {
      date: document.getElementById('note-date').value,
      mood: document.getElementById('note-mood').value,
      content: document.getElementById('note-content').value.trim()
    };
    if (!payload.content) return;
    if (id) {
      Notes.update(state, id, payload);
      UI.toast('Entry updated', 'success');
    } else {
      Notes.add(state, payload);
      UI.toast('Entry saved', 'success');
    }
    UI.closeModal(document.getElementById('note-modal'));
    persist();
  }

  function handleHabitAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const habit = Habits.getById(state, id);
    if (!habit && action !== 'add-habit') return;

    switch (action) {
      case 'complete':
        Streak.markComplete(habit);
        UI.toast(`"${habit.title}" completed! 🔥`, 'success');
        UI.checkPerfectDay(state);
        persist();
        break;
      case 'miss':
        Streak.markMissed(habit);
        UI.toast(`"${habit.title}" marked missed`, 'warning');
        persist();
        break;
      case 'edit':
        openHabitModal(habit);
        break;
      case 'delete':
        if (confirm(`Delete "${habit.title}"?`)) {
          Habits.remove(state, id);
          UI.toast('Habit deleted', 'info');
          persist();
        }
        break;
      case 'habit-note':
        document.getElementById('habit-note-habit-id').value = id;
        document.getElementById('habit-note-text').value = Habits.getHabitNote(habit, Storage.todayKey());
        UI.openModal('habit-note-modal');
        break;
      case 'add-habit':
        openHabitModal();
        break;
    }
  }

  function handleNoteAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const note = Notes.getById(state, btn.dataset.id);
    if (btn.dataset.action === 'edit-note') openNoteModal(note);
    if (btn.dataset.action === 'delete-note' && confirm('Delete this entry?')) {
      Notes.remove(state, btn.dataset.id);
      UI.toast('Entry deleted', 'info');
      persist();
    }
  }

  function bindEvents() {
    Sidebar.init({
      onNavigate: (section) => UI.navigate(section)
    });

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      state.settings.theme = next;
      UI.applyTheme(next);
      document.getElementById('setting-theme').value = next;
      persist();
    });

    document.getElementById('setting-theme')?.addEventListener('change', (e) => {
      state.settings.theme = e.target.value;
      UI.applyTheme(e.target.value);
      persist();
    });

    document.getElementById('setting-layout')?.addEventListener('change', (e) => {
      state.settings.layout = e.target.value;
      document.body.dataset.layout = e.target.value;
      persist();
    });

    document.getElementById('setting-notifications')?.addEventListener('change', (e) => {
      state.settings.notifications = e.target.checked;
      if (e.target.checked) Notifications.requestPermission();
      persist();
      if (e.target.checked) Notifications.startScheduler(state);
      else Notifications.stopScheduler();
    });

    document.getElementById('request-notif-permission')?.addEventListener('click', async () => {
      const p = await Notifications.requestPermission();
      UI.toast(p === 'granted' ? 'Notifications enabled!' : 'Permission denied', p === 'granted' ? 'success' : 'warning');
    });

    document.getElementById('notif-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      UI.toggleNotifPanel();
    });

    document.getElementById('notif-close')?.addEventListener('click', () => UI.closeNotifPanel());

    document.getElementById('notif-goto-habits')?.addEventListener('click', () => {
      UI.closeNotifPanel();
      UI.navigate('habits');
    });

    document.getElementById('notif-goto-settings')?.addEventListener('click', () => {
      UI.closeNotifPanel();
      UI.navigate('settings');
    });

    document.getElementById('notif-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-notif-complete]');
      if (!btn) return;
      const habit = Habits.getById(state, btn.dataset.notifComplete);
      if (habit) {
        Streak.markComplete(habit);
        UI.toast(`"${habit.title}" completed!`, 'success');
        persist();
        UI.renderNotifPanel(state);
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.notif-wrap')) UI.closeNotifPanel();
    });

    document.getElementById('fab-add')?.addEventListener('click', () => openHabitModal());
    document.getElementById('add-note-btn')?.addEventListener('click', () => openNoteModal());

    document.getElementById('habit-form')?.addEventListener('submit', saveHabitFromForm);
    document.getElementById('note-form')?.addEventListener('submit', saveNoteFromForm);

    document.getElementById('habit-note-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('habit-note-habit-id').value;
      const habit = Habits.getById(state, id);
      if (habit) {
        Habits.setHabitNote(habit, Storage.todayKey(), document.getElementById('habit-note-text').value.trim());
        persist();
        UI.closeModal(document.getElementById('habit-note-modal'));
        UI.toast('Note saved', 'success');
      }
    });

    document.getElementById('habit-frequency')?.addEventListener('change', (e) => toggleCustomDays(e.target.value));

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => UI.closeModal(btn.closest('dialog')));
    });

    document.getElementById('habits-list')?.addEventListener('click', handleHabitAction);
    document.getElementById('habits-empty')?.addEventListener('click', handleHabitAction);
    document.getElementById('notes-list')?.addEventListener('click', handleNoteAction);

    document.getElementById('filter-category')?.addEventListener('change', renderHabits);
    document.getElementById('sort-habits')?.addEventListener('change', renderHabits);

    document.getElementById('global-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderHabits();
      if (document.getElementById('section-notes').classList.contains('active')) {
        document.getElementById('notes-search').value = searchQuery;
        renderNotes();
      }
    });

    document.getElementById('notes-search')?.addEventListener('input', renderNotes);
    document.getElementById('notes-filter-date')?.addEventListener('change', renderNotes);

    document.getElementById('export-today-csv')?.addEventListener('click', () => {
      const day = Storage.todayKey();
      safeDownloadFile(`reflectflow-${day}.csv`, Storage.exportDaySheetCSV(state, day), 'text/csv');
    });

    document.getElementById('export-today-json')?.addEventListener('click', () => {
      const day = Storage.todayKey();
      safeDownloadFile(`reflectflow-${day}.json`, Storage.exportDaySheetJSON(state, day), 'application/json');
    });

    document.getElementById('export-json')?.addEventListener('click', () => {
      safeDownloadFile('reflectflow-backup.json', Storage.exportJSON(state), 'application/json');
    });

    document.getElementById('export-csv')?.addEventListener('click', () => {
      safeDownloadFile('reflectflow-data.csv', Storage.exportCSV(state), 'text/csv');
    });

    document.getElementById('export-print')?.addEventListener('click', () => UI.printReport(state, Storage.todayKey()));

    document.getElementById('import-json')?.addEventListener('change', (e) => {
          const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          state = AppState.replace(Storage.importJSON(reader.result));
          const report = Storage.getLastImportReport?.();
          const repaired = report?.warnings?.length || 0;
          UI.toast(repaired ? `Data imported with ${repaired} safe repairs` : 'Data imported successfully', 'success');
          initUI();
          render();
        } catch (err) {
          console.warn('Import failed. The selected file was not applied.', {
            error: err,
            report: Storage.getLastImportReport?.()
          });
          UI.toast(err.message || 'Import failed. Invalid JSON file.', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('reset-data')?.addEventListener('click', () => {
      if (confirm('Reset ALL data? This cannot be undone.')) {
        state = AppState.reset();
        initUI();
        render();
        UI.toast('Fresh start! All progress cleared — begin from today.', 'success');
      }
    });

    document.getElementById('onboarding-start')?.addEventListener('click', () => {
      state.settings.onboarded = true;
      UI.showOnboarding(false);
      persist();
    });

    window.addEventListener('hashchange', () => {
      Sidebar.close();
      const section = location.hash.slice(1) || 'dashboard';
      UI.navigate(section);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        Sidebar.close();
        UI.closeNotifPanel();
      }
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
      if (e.key === 'n' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        openHabitModal();
      }
      if (e.key === 't' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        document.getElementById('theme-toggle')?.click();
      }
      const sections = ['dashboard', 'habits', 'analytics', 'notes', 'settings'];
      if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        Sidebar.close();
        UI.navigate(sections[parseInt(e.key, 10) - 1]);
      }
    });

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!Sidebar.isMobile()) Sidebar.close();
        if (document.getElementById('section-analytics')?.classList.contains('active')) {
          Analytics.scheduleRender(state);
        }
      }, 150);
    });
  }

  function onDayChanged(data, result) {
    UI.updateDateDisplay();
    UI.updateGreeting();
    if (result?.changed) {
      state.quoteIndex = (state.quoteIndex + 1) % Storage.QUOTES.length;
    }
    render();
  }

  function startDayWatch() {
    Daily.startWatch((atMidnight) => {
      const result = Daily.checkAndApply(state, atMidnight);
      if (result.changed) AppState.commit();
      onDayChanged(state, result);
    });
  }

  function safeDownloadFile(name, content, type) {
    return BrowserUtils.safeDownloadFile(name, content, type, {
      onSuccess: (fileName) => UI.toast(`${fileName} downloaded`, 'success'),
      onError: () => UI.toast('Export failed. Please try again.', 'error')
    });
  }

  function initUI() {
    UI.applyTheme(state.settings.theme);
    document.getElementById('setting-theme').value = state.settings.theme;
    document.getElementById('setting-layout').value = state.settings.layout || 'default';
    document.body.dataset.layout = state.settings.layout || 'default';
    document.getElementById('setting-notifications').checked = !!state.settings.notifications;
    UI.showOnboarding(!state.settings.onboarded);
    UI.updateGreeting();
    UI.updateDateDisplay();
    state.quoteIndex = (state.quoteIndex + 1) % Storage.QUOTES.length;
    if (state.settings.notifications) Notifications.startScheduler(state);
  }

  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  function init() {
    UI.showLoader(true);
    state = AppState.init(Storage.load());
    AppState.subscribe((nextState) => {
      state = nextState;
      if (window.App) window.App.state = nextState;
    });
    window.App = { state, persist, render, getState: AppState.get, updateState: AppState.commit };
    bindEvents();
    initUI();
    render();
    Analytics.bindResize();
    Sidebar.close();
    const section = location.hash.slice(1) || 'dashboard';
    UI.navigate(section);
    UI.showLoader(false);
    registerSW();
    startDayWatch();
    if (Storage.consumeFreshStartToastFlag()) {
      setTimeout(() => UI.toast('Fresh start! All stats are zero — begin tracking from today.', 'success', 5000), 400);
    } else {
      setTimeout(() => UI.toast('Welcome to ReflectFlow ✦', 'info'), 600);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  return { get state() { return state; }, safeDownloadFile };
})();
