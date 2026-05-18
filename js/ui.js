/**
 * ui.js — Theme, toasts, modals, confetti, counters, achievements
 */
const UI = (() => {
  const ACHIEVEMENTS = [
    { id: 'first', icon: '🌱', title: 'First Step', desc: 'Complete any habit', check: (d) => totalCompleted(d) >= 1 },
    { id: 'streak3', icon: '🔥', title: 'On Fire', desc: '3-day streak on any habit', check: (d) => d.habits.some((h) => h.streak.current >= 3) },
    { id: 'streak7', icon: '⚡', title: 'Week Warrior', desc: '7-day streak', check: (d) => d.habits.some((h) => h.streak.current >= 7) },
    { id: 'perfect', icon: '💎', title: 'Perfect Day', desc: '100% completion today', check: (d) => Habits.todayStats(d).score === 100 && Habits.todayStats(d).scheduled > 0 },
    { id: 'eight', icon: '🎯', title: 'Full Roster', desc: '8+ active habits', check: (d) => d.habits.length >= 8 },
    { id: 'journal', icon: '📓', title: 'Reflective', desc: '5 journal entries', check: (d) => (d.notes || []).length >= 5 }
  ];

  function totalCompleted(data) {
    let n = 0;
    data.habits.forEach((h) => {
      n += Object.values(h.history || {}).filter((s) => s === 'completed').length;
    });
    return n;
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    let resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    root.setAttribute('data-theme', resolved);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = resolved === 'dark' ? '🌙' : '☀️';
  }

  function toast(message, type = 'info', duration = 3200) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  function openModal(id) {
    const dialog = document.getElementById(id);
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
  }

  function closeModal(dialog) {
    if (dialog && dialog.open) dialog.close();
  }

  function closeAllModals() {
    document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  }

  function animateCounter(el, target, duration = 800) {
    if (!el) return;
    const start = parseInt(el.textContent, 10) || 0;
    const startTime = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - startTime) / duration);
      const val = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3)));
      el.textContent = val;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function updateProductivityRing(pct) {
    const ring = document.getElementById('ring-progress');
    const label = document.getElementById('productivity-score');
    if (!ring) return;
    const r = 42;
    const circ = 2 * Math.PI * r;
    ring.style.strokeDasharray = circ;
    ring.style.strokeDashoffset = circ - (pct / 100) * circ;
    if (label) label.textContent = `${pct}%`;
  }

  function updateGreeting() {
    const el = document.getElementById('dashboard-greeting');
    if (!el) return;
    const h = new Date().getHours();
    const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    el.textContent = `${greet}! Let's make today count.`;
  }

  function updateDateDisplay() {
    const el = document.getElementById('date-display');
    if (el) {
      el.textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
    }
  }

  function renderAchievements(container, data) {
    if (!container) return;
    const unlocked = ACHIEVEMENTS.filter((a) => a.check(data));
    data.achievements = unlocked.map((a) => a.id);
    container.innerHTML = ACHIEVEMENTS.map((a) => {
      const on = unlocked.some((u) => u.id === a.id);
      return `<div class="badge ${on ? 'unlocked' : 'locked'}" title="${a.desc}">
        <span class="badge-icon">${a.icon}</span>
        <span class="badge-title">${a.title}</span>
      </div>`;
    }).join('');
  }

  function renderStreakList(container, data) {
    if (!container) return;
    const top = [...data.habits].sort((a, b) => b.streak.current - a.streak.current).slice(0, 5);
    container.innerHTML = top.length
      ? top
          .map(
            (h) => `
        <li class="streak-list-item">
          <span class="streak-flame ${h.streak.current >= 3 ? 'streak-flame--active' : ''}">🔥</span>
          <span class="name">${Habits.escapeHtml(h.title)}</span>
          <span class="count">${h.streak.current} days</span>
        </li>`
          )
          .join('')
      : '<li class="empty-hint">No streaks yet</li>';
  }

  function renderTodaySummary(container, data) {
    if (!container) return;
    const stats = Habits.todayStats(data);
    const items = data.habits
      .filter((h) => Streak.isScheduledDay(h, new Date()))
      .map((h) => {
        const st = Streak.getStatus(h, Storage.todayKey());
        const icon = st === 'completed' ? '✅' : st === 'missed' ? '❌' : '⏳';
        return `<div class="summary-row"><span>${icon}</span><span>${Habits.escapeHtml(h.title)}</span></div>`;
      });
    container.innerHTML = `
      <p class="summary-stats">${stats.completed}/${stats.scheduled} completed · ${stats.pending} pending</p>
      <div class="summary-list">${items.join('') || '<p class="empty-hint">No habits scheduled today</p>'}</div>`;
  }

  function checkPerfectDay(data) {
    const s = Habits.todayStats(data);
    if (s.scheduled > 0 && s.score === 100 && s.completed === s.scheduled) {
      fireConfetti();
      toast('Perfect day! You crushed every habit! 🎉', 'success', 5000);
    }
  }

  /* Confetti — lightweight canvas particles */
  function fireConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#22c55e'];
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 10
    }));

    let frame = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });
      frame++;
      if (frame < 120) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    tick();
  }

  function showLoader(show) {
    const loader = document.getElementById('app-loader');
    if (loader) loader.classList.toggle('hidden', !show);
  }

  function showOnboarding(show) {
    const ob = document.getElementById('onboarding');
    if (ob) {
      ob.classList.toggle('hidden', !show);
      ob.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
  }

  function closeNotifPanel() {
    document.getElementById('notif-panel')?.classList.add('hidden');
    document.getElementById('notif-btn')?.setAttribute('aria-expanded', 'false');
  }

  function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    const isHidden = panel.classList.toggle('hidden');
    document.getElementById('notif-btn')?.setAttribute('aria-expanded', String(!isHidden));
    if (!isHidden && window.App?.state) renderNotifPanel(window.App.state);
  }

  function getTodayTasks(data) {
    const today = Storage.todayKey();
    const d = new Date(today + 'T12:00:00');
    const tasks = { pending: [], completed: [], missed: [], rest: [] };

    data.habits.forEach((h) => {
      if (!Streak.isScheduledDay(h, d)) {
        tasks.rest.push(h);
        return;
      }
      const st = Streak.getStatus(h, today);
      if (st === 'completed') tasks.completed.push(h);
      else if (st === 'missed') tasks.missed.push(h);
      else tasks.pending.push(h);
    });
    return tasks;
  }

  function renderNotifPanel(data) {
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    if (!list) return;

    const { pending, completed, missed } = getTodayTasks(data);
    const count = pending.length;

    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    }

    if (!pending.length && !completed.length && !missed.length) {
      const empty = document.createElement('li');
      empty.className = 'notif-empty';
      empty.textContent = 'No habits scheduled today.';
      list.replaceChildren(empty);
      return;
    }

    const nodes = [];
    const addTitle = (text) => {
      const li = document.createElement('li');
      li.className = 'notif-section-title';
      li.textContent = text;
      nodes.push(li);
    };

    if (pending.length) {
      addTitle(`Pending (${pending.length})`);
      pending.forEach((h) => {
        const li = document.createElement('li');
        li.className = 'notif-item notif-item--pending';
        const title = document.createElement('span');
        title.textContent = h.title;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn--success btn-sm';
        button.dataset.notifComplete = h.id;
        button.textContent = 'Done';
        li.append(title, button);
        nodes.push(li);
      });
    }
    if (completed.length) {
      addTitle(`Completed (${completed.length})`);
      completed.forEach((h) => {
        const li = document.createElement('li');
        li.className = 'notif-item notif-item--done';
        li.textContent = `✓ ${h.title}`;
        nodes.push(li);
      });
    }
    if (missed.length) {
      addTitle(`Missed (${missed.length})`);
      missed.forEach((h) => {
        const li = document.createElement('li');
        li.className = 'notif-item notif-item--miss';
        li.textContent = `✗ ${h.title}`;
        nodes.push(li);
      });
    }
    list.replaceChildren(...nodes);
  }

  function updateNotifBadge(data) {
    const badge = document.getElementById('notif-badge');
    if (!badge || !data) return;
    const n = getTodayTasks(data).pending.length;
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
  }

  function navigate(section) {
    if (typeof Sidebar !== 'undefined') Sidebar.close();
    closeNotifPanel();
    document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
    const sec = document.getElementById(`section-${section}`);
    const link = document.querySelector(`[data-section="${section}"]`);
    if (sec) sec.classList.add('active');
    if (link) link.classList.add('active');
    if (section === 'analytics' && window.App?.state) {
      Analytics.scheduleRender(window.App.state);
    }
    if (location.hash !== `#${section}`) {
      history.replaceState(null, '', `#${section}`);
    }
  }

  function safeOpenPrintWindow(html, title = 'ReflectFlow Report') {
    return BrowserUtils.safeOpenPrintWindow(html, title, {
      onBlocked: () => toast('Print window was blocked. Please allow popups for this page and try again.', 'warning', 5500),
      onError: () => toast('Could not prepare the print report. Please try again.', 'error')
    });
  }

  function printReport(data, dateKey = Storage.todayKey()) {
    const stats = Habits.todayStats(data);
    const d = new Date(dateKey + 'T12:00:00');
    const journal = Storage.getJournalForDate(data, dateKey);

    const habitsHtml = data.habits
      .filter((h) => Streak.isScheduledDay(h, d))
      .map((h) => {
        const status = Habits.escapeHtml(Streak.getStatus(h, dateKey) || 'pending');
        const note = (h.habitNotes || {})[dateKey] || '—';
        return `<tr>
          <td>${Habits.escapeHtml(h.title)}</td>
          <td>${status}</td>
          <td>${Habits.escapeHtml(h.target || '—')}</td>
          <td>${Habits.escapeHtml(note)}</td>
        </tr>`;
      })
      .join('');

    const journalHtml = journal
      ? `<p><strong>Mood:</strong> ${Habits.escapeHtml(journal.mood)}</p>
         <p>${Habits.escapeHtml(journal.content)}</p>`
      : '<p><em>No journal entry for this day.</em></p>';

    const html = `<!DOCTYPE html><html><head><title>ReflectFlow — ${dateKey}</title>
    <style>body{font-family:system-ui;padding:2rem;max-width:800px;margin:0 auto}
    h2{margin-top:1.5rem}table{width:100%;border-collapse:collapse;margin:1rem 0}
    td,th{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f4f4f5}
    .journal{background:#f8fafc;padding:1rem;border-radius:8px;border:1px solid #e4e4e7}</style>
    </head><body>
    <h1>Daily Sheet — ${dateKey}</h1>
    <p>Generated ${new Date().toLocaleString()}</p>
    <p><strong>Productivity:</strong> ${stats.score}% (${stats.completed}/${stats.scheduled} habits)</p>
    <h2>Habits</h2>
    <table><thead><tr><th>Habit</th><th>Status</th><th>Target</th><th>Habit Note</th></tr></thead>
    <tbody>${habitsHtml || '<tr><td colspan="4">No habits scheduled</td></tr>'}</tbody></table>
    <h2>Journal</h2>
    <div class="journal">${journalHtml}</div>
    </body></html>`;

    return safeOpenPrintWindow(html, `ReflectFlow ${dateKey}`);
  }

  return {
    applyTheme,
    toast,
    openModal,
    closeModal,
    closeAllModals,
    animateCounter,
    updateProductivityRing,
    updateGreeting,
    updateDateDisplay,
    renderAchievements,
    renderStreakList,
    renderTodaySummary,
    checkPerfectDay,
    fireConfetti,
    showLoader,
    showOnboarding,
    navigate,
    safeOpenPrintWindow,
    printReport,
    closeNotifPanel,
    toggleNotifPanel,
    renderNotifPanel,
    updateNotifBadge,
    getTodayTasks,
    ACHIEVEMENTS
  };
})();
